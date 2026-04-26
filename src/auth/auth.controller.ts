import { Controller, Get, Req, UseGuards, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService
  ) {}

	@Get('google')
	@UseGuards(AuthGuard('google'))
	async googleAuth(@Req() req) {}

	@Get('google/callback')
	@UseGuards(AuthGuard('google'))
	async googleAuthRedirect(@Req() req, @Res() res) {
	// 1. D'abord on valide/crée l'utilisateur en base avec ton AuthService
	const user = await this.authService.validateGoogleUser(req.user);

	// 2. Ensuite on génère le token avec l'utilisateur qui sort de la DB
	const authData = await this.authService.login(user);

	// 3. Rediriger vers le frontend avec le token et les infos utilisateur
	const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:4200';
	const queryParams = `?token=${authData.access_token}&user=${encodeURIComponent(JSON.stringify(authData.user))}`;
	const redirectUrl = `${frontendUrl}/login${queryParams}`;
	
	console.log("Redirecting to frontend:", redirectUrl);
	return res.redirect(redirectUrl);
	}

	@Get('profile')
	@UseGuards(AuthGuard('jwt'))
	getProfile(@Req() req) {
	return req.user;
	}
}
