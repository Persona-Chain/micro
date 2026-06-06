import { Module } from '@nestjs/common'
import { AuthModule } from './auth/auth.module'
import { PrismaModule } from './prisma/prisma.module'
import { MailService } from './mail/mail.service'

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [],
  providers: [MailService],
})
export class AppModule {}
