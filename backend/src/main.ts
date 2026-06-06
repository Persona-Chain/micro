import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ValidationPipe } from '@nestjs/common'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }))
  app.enableShutdownHooks()
  const port = process.env.PORT || 4000
  await app.listen(port)
  console.log(`Backend listening on ${port}`)
}

bootstrap()
