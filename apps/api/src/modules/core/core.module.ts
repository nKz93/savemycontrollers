import { Module } from "@nestjs/common";
import { ReferenceGeneratorService } from "./services/reference-generator.service.js";

/**
 * Module Core : briques transversales (erreurs, pagination, evenements,
 * filtre HTTP, generation de references) importees par les autres modules
 * metier. Volontairement sans dependance vers un module metier.
 */
@Module({
  providers: [ReferenceGeneratorService],
  exports: [ReferenceGeneratorService],
})
export class CoreModule {}
