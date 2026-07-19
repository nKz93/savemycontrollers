import { Body, Controller, Post } from "@nestjs/common";
import { ApiBody, ApiResponse, ApiTags } from "@nestjs/swagger";
import { validateConfigurationSchema, type ValidateConfigurationRequest, type ConfigurationResultDto } from "@smc/contracts";
import { ZodValidationPipe } from "../../core/http/zod-validation.pipe.js";
import { ConfiguratorService } from "../services/configurator.service.js";
import { ValidateConfigurationBodyDto, ConfigurationResultResponseDto } from "../swagger/configurator.swagger-dto.js";

@ApiTags("configurator")
@Controller("configurator")
export class ConfiguratorController {
  constructor(private readonly configurator: ConfiguratorService) {}

  @Post("validate")
  @ApiBody({ type: ValidateConfigurationBodyDto })
  @ApiResponse({ status: 201, type: ConfigurationResultResponseDto })
  validate(@Body(new ZodValidationPipe(validateConfigurationSchema)) body: ValidateConfigurationRequest): Promise<ConfigurationResultDto> {
    return this.configurator.validate(body);
  }
}
