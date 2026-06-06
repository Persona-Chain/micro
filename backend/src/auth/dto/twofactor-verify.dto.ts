import { IsString } from 'class-validator'

export class TwoFactorVerifyDto {
  @IsString()
  code!: string
}
