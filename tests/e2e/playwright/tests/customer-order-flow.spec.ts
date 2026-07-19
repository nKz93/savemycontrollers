import { test, expect, request as pwRequest, type Page, type BrowserContext } from "@playwright/test";

const API_URL = process.env.E2E_API_URL ?? "http://localhost:3001";
const WEB_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

// Le seed de demonstration (voir prisma/seed/catalog-demo.ts) cree ces
// entites de facon deterministe : on peut donc s'y referer par leur slug
// stable plutot que par un id genere.
const MODEL_FAMILY_SLUG = "playstation";
const MODEL_SLUG = "dualsense";

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}@e2e.test`;
}

/** Inscrit et connecte un nouvel utilisateur via l'interface reelle, retourne son email/mot de passe. */
async function registerAndLogin(page: Page, prefix: string): Promise<{ email: string; password: string }> {
  const email = uniqueEmail(prefix);
  const password = "MotDePasseSolide123!";

  await page.goto("/inscription");
  await page.getByLabel("Prenom").fill("Test");
  await page.getByLabel("Nom", { exact: true }).fill("E2E");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Creer mon compte" }).click();
  try {
    await expect(page.getByText("Compte cree")).toBeVisible({ timeout: 15_000 });
  } catch (err) {
    const errorAlertText = await page.locator(".smc-alert--error").allTextContents();
    // eslint-disable-next-line no-console
    console.log("DIAGNOSTIC registerAndLogin (inscription) — contenu de .smc-alert--error :", JSON.stringify(errorAlertText));
    // eslint-disable-next-line no-console
    console.log("DIAGNOSTIC registerAndLogin (inscription) — URL courante :", page.url());
    throw err;
  }

  // Le compte de demonstration doit etre verifie manuellement en base
  // dans ce scenario E2E (aucun envoi d'email reel n'est disponible en
  // CI) — voir .github/workflows/e2e.yml, etape "verifie l'email de test".

  await page.goto("/connexion");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("link", { name: "Mes commandes" })).toBeVisible({ timeout: 10_000 });

  return { email, password };
}

async function addStickDriftRepairToCart(page: Page): Promise<void> {
  await page.goto(`/configurateur/${MODEL_FAMILY_SLUG}/${MODEL_SLUG}`);
  await page.getByRole("checkbox", { name: /Correction de stick drift/ }).click();
  await expect(page.getByText("Total", { exact: true })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Ajouter au panier" }).click();
  try {
    await expect(page.getByText("Ajoute au panier.")).toBeVisible({ timeout: 10_000 });
  } catch (err) {
    // DIAGNOSTIC : capture le message d'erreur reel affiche par
    // <ApiErrorAlert>, s'il y en a un, directement dans le journal CI —
    // evite d'avoir a telecharger l'artefact de rapport pour diagnostiquer.
    const errorAlertText = await page.locator(".smc-alert--error").allTextContents();
    // eslint-disable-next-line no-console
    console.log("DIAGNOSTIC addStickDriftRepairToCart — contenu de .smc-alert--error :", JSON.stringify(errorAlertText));
    // eslint-disable-next-line no-console
    console.log("DIAGNOSTIC addStickDriftRepairToCart — URL courante :", page.url());
    throw err;
  }
}

test.describe("Parcours client transactionnel — validation fonctionnelle reelle", () => {
  test.beforeEach(async ({ page }) => {
    // DIAGNOSTIC global : journalise le corps complet (y compris
    // debugDetail hors production) de toute reponse API en erreur —
    // complement des diagnostics locaux ci-dessus, sans devoir deviner
    // quel appel precis a echoue.
    page.on("response", (response) => {
      if (response.url().includes(API_URL) && response.status() >= 400) {
        response
          .json()
          .then((body) => {
            // eslint-disable-next-line no-console
            console.log(`DIAGNOSTIC reseau — ${response.status()} ${response.url()} :`, JSON.stringify(body));
          })
          .catch(() => {
            /* corps non-JSON, rien a journaliser */
          });
      }
    });
  });

  test("catalogue -> fiche modele -> configurateur affiche prix et delai calcules par le serveur", async ({ page }) => {
    await page.goto("/catalogue");
    await expect(page.getByRole("heading", { name: "Catalogue" })).toBeVisible();
    await expect(page.getByRole("link", { name: "DualSense", exact: true })).toBeVisible();

    await page.getByRole("link", { name: "DualSense", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Sony DualSense", exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Configurer une reparation" }).first().click();
    await page.getByRole("checkbox", { name: /Correction de stick drift/ }).click();

    // Prix ET delai doivent apparaitre — tous deux calcules par l'API, jamais par le navigateur.
    await expect(page.getByText(/jours ouvres/)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".smc-price").first()).toBeVisible();
  });

  test("incompatibilite serveur : les boutons arriere (Edge) sont refuses sur la DualSense standard", async ({ page }) => {
    await page.goto(`/configurateur/${MODEL_FAMILY_SLUG}/${MODEL_SLUG}`);
    await page.getByRole("checkbox", { name: /Remplacement des boutons arriere \(Edge\)/ }).click();
    await expect(page.getByText(/pas compatible avec le modele/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Ajouter au panier" })).toBeDisabled();
  });

  test("dependance obligatoire : les boutons arriere exigent un nettoyage complet", async ({ page }) => {
    await page.goto(`/configurateur/playstation/dualsense-edge`);
    await page.getByRole("checkbox", { name: /Remplacement des boutons arriere \(Edge\)/ }).click();
    await expect(page.getByText(/necessite une prestation complementaire/)).toBeVisible({ timeout: 10_000 });

    await page.getByRole("checkbox", { name: /^Nettoyage complet/ }).click();
    await expect(page.getByText(/necessite une prestation complementaire/)).not.toBeVisible({ timeout: 10_000 });
  });

  test("exclusion mutuelle : reparation express et personnalisation ne peuvent pas etre combinees", async ({ page }) => {
    await page.goto(`/configurateur/${MODEL_FAMILY_SLUG}/${MODEL_SLUG}`);
    await page.getByRole("checkbox", { name: /Reparation express \(24h\)/ }).click();
    await page.getByRole("checkbox", { name: /Personnalisation de la coque/ }).click();
    await expect(page.getByText(/ne peuvent pas etre combinees|ne peut pas etre combine/)).toBeVisible({ timeout: 10_000 });
  });

  test("recommandation non bloquante : conseil de nettoyage avec la correction de stick drift", async ({ page }) => {
    await page.goto(`/configurateur/${MODEL_FAMILY_SLUG}/${MODEL_SLUG}`);
    await page.getByRole("checkbox", { name: /Correction de stick drift/ }).click();
    await expect(page.getByText(/recommandons un nettoyage complet/)).toBeVisible({ timeout: 10_000 });
    // Non bloquant : le bouton doit rester utilisable.
    await expect(page.getByRole("button", { name: "Ajouter au panier" })).toBeEnabled();
  });

  test("panier invite : cookie pose, contenu persiste apres rafraichissement de la page", async ({ page, context }) => {
    await addStickDriftRepairToCart(page);

    const cookies = await context.cookies();
    const guestCookie = cookies.find((c) => c.name === "smc_guest_cart_token");
    expect(guestCookie).toBeDefined();
    expect(guestCookie?.httpOnly).toBe(true);

    await page.goto("/panier");
    await expect(page.getByText("DualSense").first()).toBeVisible();

    // Persistance apres rafraichissement (pas seulement en memoire cote client).
    await page.reload();
    await expect(page.getByText("DualSense").first()).toBeVisible();
  });

  test("CSRF : une requete mutante directe sans jeton est refusee par l'API", async ({ page, context }) => {
    // Etablit une session invite reelle (cookies valides) avant de tenter
    // un contournement du flux normal de l'application.
    await page.goto("/catalogue");
    await page.request.post(`${API_URL}/cart/guest`);

    const apiContext = await pwRequest.newContext({ baseURL: API_URL, extraHTTPHeaders: {} });
    const cookies = await context.cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

    // Requete mutante avec les cookies de session valides MAIS sans
    // l'en-tete CSRF (X-CSRF-Token) : doit etre refusee.
    const response = await apiContext.post("/cart/guest", { headers: { Cookie: cookieHeader } });
    expect(response.status()).toBe(403);
    await apiContext.dispose();
  });

  test("fusion du panier invite a la connexion", async ({ page }) => {
    await addStickDriftRepairToCart(page);
    await registerAndLogin(page, "merge");

    await page.goto("/panier");
    // L'article ajoute avant connexion doit apparaitre dans le panier du
    // compte desormais authentifie (fusion reelle, pas juste visuelle).
    await expect(page.getByText("DualSense").first()).toBeVisible({ timeout: 10_000 });
  });

  test("controle de propriete : un client ne peut pas consulter l'adresse d'un autre compte", async ({ browser }) => {
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await registerAndLogin(pageA, "owner-a");

    await pageA.goto("/compte/adresses");
    await pageA.getByRole("button", { name: "Ajouter une adresse" }).click();
    await pageA.getByLabel("Destinataire").fill("Client A");
    await pageA.getByLabel("Adresse").fill("1 rue de Test");
    await pageA.getByLabel("Code postal").fill("75000");
    await pageA.getByLabel("Ville").fill("Paris");
    await pageA.getByRole("button", { name: "Enregistrer" }).click();
    await expect(pageA.getByText("Client A")).toBeVisible({ timeout: 10_000 });

    const addressId = await pageA.evaluate(async (apiUrl) => {
      const res = await fetch(`${apiUrl}/addresses`, { credentials: "include" });
      const list = (await res.json()) as Array<{ id: string }>;
      return list[0]?.id;
    }, API_URL);
    expect(addressId).toBeTruthy();

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await registerAndLogin(pageB, "owner-b");

    const forbiddenStatus = await pageB.evaluate(
      async ({ apiUrl, id }) => {
        const res = await fetch(`${apiUrl}/addresses/${id}`, { credentials: "include" });
        return res.status;
      },
      { apiUrl: API_URL, id: addressId },
    );
    // 404, jamais 200 : l'adresse d'un autre compte est invisible, pas
    // seulement "interdite" (aucune fuite d'existence).
    expect(forbiddenStatus).toBe(404);

    await contextA.close();
    await contextB.close();
  });

  test("erreur structuree affichee proprement (identifiants invalides)", async ({ page }) => {
    await page.goto("/connexion");
    await page.getByLabel("Email").fill("inconnu-e2e@test.local");
    await page.getByLabel("Mot de passe").fill("MauvaisMotDePasse123!");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.locator(".smc-alert--error")).toBeVisible({ timeout: 10_000 });
  });

  test("creation de commande idempotente : deux soumissions rapides ne creent qu'une seule commande", async ({ page }) => {
    await addStickDriftRepairToCart(page);
    await registerAndLogin(page, "checkout");
    await page.goto("/panier");
    await page.evaluate(async (apiUrl) => {
      await fetch(`${apiUrl}/cart/merge`, { method: "POST", credentials: "include" });
    }, API_URL);
    await page.reload();

    await page.goto("/compte/adresses");
    await page.getByRole("button", { name: "Ajouter une adresse" }).click();
    await page.getByLabel("Destinataire").fill("Client Checkout");
    await page.getByLabel("Adresse").fill("1 rue de Test");
    await page.getByLabel("Code postal").fill("75000");
    await page.getByLabel("Ville").fill("Paris");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Client Checkout")).toBeVisible({ timeout: 10_000 });

    await page.goto("/checkout");
    await expect(page.getByRole("button", { name: "Valider la commande" })).toBeEnabled({ timeout: 10_000 });

    // Deux clics rapproches sur le meme bouton (simule un double-clic ou
    // une double soumission reseau) : verifie directement en base via
    // l'API qu'une seule commande existe pour ce compte.
    const button = page.getByRole("button", { name: "Valider la commande" });
    await Promise.all([button.click(), button.click({ force: true }).catch(() => undefined)]);

    await page.waitForURL(/\/compte\/commandes\//, { timeout: 15_000 });

    const orderCount = await page.evaluate(async (apiUrl) => {
      const res = await fetch(`${apiUrl}/orders`, { credentials: "include" });
      const orders = (await res.json()) as unknown[];
      return orders.length;
    }, API_URL);
    expect(orderCount).toBe(1);
  });

  test("affichage responsive mobile : navigation et catalogue restent utilisables", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/catalogue");
    await expect(page.getByRole("heading", { name: "Catalogue" })).toBeVisible();

    // Aucun debordement horizontal (signe classique d'une mise en page non responsive).
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(hasHorizontalOverflow).toBe(false);

    await page.screenshot({ path: "test-results/mobile-catalogue.png", fullPage: true });
  });
});
