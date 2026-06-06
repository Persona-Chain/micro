import { Injectable } from '@nestjs/common'

@Injectable()
export class MailService {
  async sendVerification(email: string, token: string) {
    console.log(`Send verification to ${email}: token=${token}`)
  }

  async sendPasswordReset(email: string, token: string) {
    console.log(`Send password reset to ${email}: token=${token}`)
  }
}
