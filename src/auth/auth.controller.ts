import { Controller, Get, Req, UseGuards, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

	@Get('google')
	@UseGuards(AuthGuard('google'))
	async googleAuth(@Req() req) {}

	@Get('google/callback')
	@UseGuards(AuthGuard('google'))
	async googleAuthRedirect(@Req() req) {
	// 1. D'abord on valide/crée l'utilisateur en base avec ton AuthService
	const user = await this.authService.validateGoogleUser(req.user);

	// 2. Ensuite on génère le token avec l'utilisateur qui sort de la DB
	return this.authService.login(user);
	}

	@Get('profile')
	@UseGuards(AuthGuard('jwt'))
	getProfile(@Req() req) {
	return req.user;
	}
}
