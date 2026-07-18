import { Module } from "@nestjs/common";
import { FileRepository } from "./repositories/file.repository.js";
import { FileService } from "./services/file.service.js";

@Module({
  providers: [FileRepository, FileService],
  exports: [FileService],
})
export class FilesModule {}
