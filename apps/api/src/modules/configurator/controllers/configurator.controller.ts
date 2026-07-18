import { Body, Controller, Post, UsePipes } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { validateConfigurationSchema, type ValidateConfigurationRequest } from "@smc/contracts";
import { ZodValidationPipe } from "../../core/http/zod-validation.pipe.js";
import { ConfiguratorService } from "../services/configurator.service.js";

@ApiTags("configurator")
@Controller("configurator")
export class ConfiguratorController {
  constructor(private readonly configurator: ConfiguratorService) {}

  @Post("validate")
  @UsePipes(new ZodValidationPipe(validateConfigurationSchema))
  validate(@Body() body: ValidateConfigurationRequest) {
    return this.configurator.validate(body);
  }
}
