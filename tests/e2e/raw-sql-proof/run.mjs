import pg from "pg";

const conn = { host: "localhost", user: "smc", password: "smc_dev_password", database: "smc_test", port: 5432 };
const pool = new pg.Pool(conn);

// Purge pour rendre l'execution idempotente (rejouable a l'identique)
await pool.query(`TRUNCATE reference_counters, outbox_events, carts_min, orders_min, volume_discount_rules_min, lead_time_rules_min, addresses_min, carts_owner_min;`);

let failures = 0;
function check(label, cond) {
  console.log(`${cond ? "OK  " : "FAIL"} - ${label}`);
  if (!cond) failures++;
}

async function nextReferenceSequence(client, scope) {
  const year = new Date().getUTCFullYear();
  const { rows } = await client.query(
    `INSERT INTO reference_counters (scope, year, last_value)
     VALUES ($1, $2, 1)
     ON CONFLICT (scope, year)
     DO UPDATE SET last_value = reference_counters.last_value + 1
     RETURNING last_value;`,
    [scope, year],
  );
  return rows[0].last_value;
}

async function testReferenceConcurrency() {
  console.log("\n=== Test 1 : generation concurrente de 30 references (compteur atomique) ===");
  const promises = Array.from({ length: 30 }, () => nextReferenceSequence(pool, "ORDER"));
  const values = await Promise.all(promises);
  const unique = new Set(values);
  check("30 appels concurrents produisent 30 valeurs strictement distinctes", unique.size === 30);
  check("les valeurs forment bien la sequence 1..30 sans trou ni doublon", 
    JSON.stringify([...unique].sort((a,b)=>a-b)) === JSON.stringify(Array.from({length:30},(_,i)=>i+1)));
}

async function testOutboxConcurrency() {
  console.log("\n=== Test 2 : prise atomique d'evenements Outbox par plusieurs workers concurrents ===");
  const insertPromises = [];
  for (let i = 0; i < 50; i++) {
    insertPromises.push(
      pool.query(
        `INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload, correlation_id)
         VALUES ('TestEvent', 'Test', gen_random_uuid(), '{}'::jsonb, gen_random_uuid())`,
      ),
    );
  }
  await Promise.all(insertPromises);

  async function claimBatch(client, limit, workerId) {
    await client.query("BEGIN");
    try {
      const { rows } = await client.query(
        `SELECT id FROM outbox_events
         WHERE status = 'PENDING' AND next_attempt_at <= NOW()
         ORDER BY occurred_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED;`,
        [limit],
      );
      if (rows.length > 0) {
        const ids = rows.map((r) => r.id);
        await client.query(
          `UPDATE outbox_events SET status = 'PROCESSING', locked_at = NOW(), locked_by = $1, attempts = attempts + 1
           WHERE id = ANY($2::uuid[]);`,
          [workerId, ids],
        );
      }
      await client.query("COMMIT");
      return rows.map((r) => r.id);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  }

  // 5 "workers" concurrents, chacun sur sa propre connexion (essentiel :
  // FOR UPDATE SKIP LOCKED n'a de sens qu'entre transactions/connexions
  // distinctes), chacun reclamant jusqu'a 15 evenements.
  const clients = await Promise.all(Array.from({ length: 5 }, () => pool.connect()));
  try {
    const results = await Promise.all(
      clients.map((client, idx) => claimBatch(client, 15, `worker-${idx}`)),
    );
    const allClaimed = results.flat();
    const uniqueClaimed = new Set(allClaimed);
    check("aucun evenement n'est reclame par deux workers a la fois", uniqueClaimed.size === allClaimed.length);
    check("le nombre total d'evenements reclames ne depasse pas le nombre inseres (50)", allClaimed.length <= 50);
    check("au moins un evenement a ete reclame", allClaimed.length > 0);

    const { rows: statusRows } = await pool.query(
      `SELECT status, COUNT(*) FROM outbox_events GROUP BY status;`,
    );
    console.log("  repartition des statuts apres reclamation :", statusRows);
  } finally {
    clients.forEach((c) => c.release());
  }
}

async function testCheckoutIdempotency() {
  console.log("\n=== Test 3 : conversion panier -> commande, deux checkouts concurrents ===");
  const { rows: cartRows } = await pool.query(`INSERT INTO carts_min DEFAULT VALUES RETURNING id;`);
  const cartId = cartRows[0].id;

  async function attemptCheckout(client, cartId, orderRef) {
    await client.query("BEGIN");
    try {
      const { rows } = await client.query(
        `UPDATE carts_min SET converted_at = NOW()
         WHERE id = $1 AND converted_at IS NULL
         RETURNING id;`,
        [cartId],
      );
      if (rows.length === 0) {
        await client.query("ROLLBACK");
        return { created: false };
      }
      const { rows: orderRows } = await client.query(
        `INSERT INTO orders_min (reference, subtotal_minor, tax_minor, total_minor)
         VALUES ($1, 1000, 200, 1200) RETURNING id;`,
        [orderRef],
      );
      await client.query(
        `UPDATE carts_min SET converted_to_order_id = $1 WHERE id = $2;`,
        [orderRows[0].id, cartId],
      );
      await client.query("COMMIT");
      return { created: true, orderId: orderRows[0].id };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  }

  const [clientA, clientB] = await Promise.all([pool.connect(), pool.connect()]);
  try {
    const [resA, resB] = await Promise.all([
      attemptCheckout(clientA, cartId, "SMC-ORD-TEST-A"),
      attemptCheckout(clientB, cartId, "SMC-ORD-TEST-B"),
    ]);
    const createdCount = [resA, resB].filter((r) => r.created).length;
    check("une seule des deux requetes concurrentes cree effectivement une commande", createdCount === 1);

    const { rows: orderCountRows } = await pool.query(`SELECT COUNT(*) FROM orders_min;`);
    check("une seule commande existe en base pour ce panier", Number(orderCountRows[0].count) === 1);
  } finally {
    clientA.release();
    clientB.release();
  }
}

async function testCheckConstraints() {
  console.log("\n=== Test 4 : contraintes SQL CHECK (rejet des donnees invalides) ===");

  async function expectReject(label, query, params) {
    try {
      await pool.query(query, params);
      check(label, false);
    } catch (e) {
      check(label, e.code === "23514"); // check_violation
    }
  }
  async function expectAccept(label, query, params) {
    try {
      await pool.query(query, params);
      check(label, true);
    } catch (e) {
      check(`${label} (erreur inattendue: ${e.message})`, false);
    }
  }

  await expectReject(
    "montant negatif rejete (orders_min.subtotal_minor < 0)",
    `INSERT INTO orders_min (reference, subtotal_minor, tax_minor, total_minor) VALUES ($1, -100, 0, -100);`,
    ["SMC-ORD-NEG"],
  );

  await expectReject(
    "quantite nulle/negative rejetee (volume_discount_rules_min.min_quantity <= 0)",
    `INSERT INTO volume_discount_rules_min (min_quantity, discount_basis_points) VALUES (0, 500);`,
  );

  await expectReject(
    "taux de remise superieur a 100% rejete",
    `INSERT INTO volume_discount_rules_min (min_quantity, discount_basis_points) VALUES (5, 10001);`,
  );
  await expectAccept(
    "taux de remise a exactement 100% accepte (borne incluse)",
    `INSERT INTO volume_discount_rules_min (min_quantity, discount_basis_points) VALUES (5, 10000);`,
  );

  await expectReject(
    "delai minimum superieur au maximum rejete",
    `INSERT INTO lead_time_rules_min (min_days, max_days) VALUES (10, 5);`,
  );

  await expectReject(
    "adresse sans aucun proprietaire rejetee",
    `INSERT INTO addresses_min (user_id, company_id) VALUES (NULL, NULL);`,
  );
  await expectReject(
    "adresse avec DEUX proprietaires (user ET entreprise) rejetee",
    `INSERT INTO addresses_min (user_id, company_id) VALUES (gen_random_uuid(), gen_random_uuid());`,
  );
  await expectAccept(
    "adresse avec exactement un proprietaire (utilisateur) acceptee",
    `INSERT INTO addresses_min (user_id, company_id) VALUES (gen_random_uuid(), NULL);`,
  );

  await expectReject(
    "panier sans proprietaire ni jeton invite rejete",
    `INSERT INTO carts_owner_min (user_id, company_id, guest_token_hash) VALUES (NULL, NULL, NULL);`,
  );
  await expectAccept(
    "panier invite (jeton seul, sans utilisateur ni entreprise) accepte",
    `INSERT INTO carts_owner_min (user_id, company_id, guest_token_hash) VALUES (NULL, NULL, 'hash123');`,
  );
  await expectAccept(
    "panier utilisateur particulier (sans entreprise) accepte",
    `INSERT INTO carts_owner_min (user_id, company_id, guest_token_hash) VALUES (gen_random_uuid(), NULL, NULL);`,
  );
  await expectAccept(
    "panier d'entreprise (utilisateur + entreprise, exception metier justifiee) accepte",
    `INSERT INTO carts_owner_min (user_id, company_id, guest_token_hash) VALUES (gen_random_uuid(), gen_random_uuid(), NULL);`,
  );
  await expectReject(
    "panier avec entreprise SEULE (sans utilisateur responsable) rejete",
    `INSERT INTO carts_owner_min (user_id, company_id, guest_token_hash) VALUES (NULL, gen_random_uuid(), NULL);`,
  );
  await expectReject(
    "panier utilisateur ET jeton invite simultanement rejete",
    `INSERT INTO carts_owner_min (user_id, company_id, guest_token_hash) VALUES (gen_random_uuid(), NULL, 'hash456');`,
  );
  await expectReject(
    "panier entreprise ET jeton invite simultanement rejete",
    `INSERT INTO carts_owner_min (user_id, company_id, guest_token_hash) VALUES (gen_random_uuid(), gen_random_uuid(), 'hash789');`,
  );
}

async function main() {
  await testReferenceConcurrency();
  await testOutboxConcurrency();
  await testCheckoutIdempotency();
  await testCheckConstraints();

  console.log(`\n=== Resultat global : ${failures === 0 ? "TOUS LES TESTS PASSENT" : failures + " ECHEC(S)"} ===`);
  await pool.end();
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Erreur fatale :", e);
  process.exit(1);
});
