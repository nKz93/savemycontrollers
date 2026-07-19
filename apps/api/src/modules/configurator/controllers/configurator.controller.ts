import { Body, Controller, Post, UsePipes } from "@nestjs/common";
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
  @UsePipes(new ZodValidationPipe(validateConfigurationSchema))
  validate(@Body() body: ValidateConfigurationRequest): Promise<ConfigurationResultDto> {
    return this.configurator.validate(body);
  }
}
