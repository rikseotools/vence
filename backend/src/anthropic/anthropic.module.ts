import { Global, Module } from '@nestjs/common';
import { AnthropicService } from './anthropic.service';

/**
 * Módulo global que provee `AnthropicService`.
 *
 * Al ser `@Global()`, cualquier módulo que importe `AnthropicModule` (o que
 * esté en la cadena de importaciones de `AppModule`) puede inyectar
 * `AnthropicService` directamente sin importar el módulo explícitamente.
 */
@Global()
@Module({
  providers: [AnthropicService],
  exports: [AnthropicService],
})
export class AnthropicModule {}
