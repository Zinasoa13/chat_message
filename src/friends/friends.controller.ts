import { Controller, Post, Body, Get, Req, UseGuards, Param, Patch } from '@nestjs/common';
import { FriendsService } from './friends.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('friends')
@UseGuards(AuthGuard('jwt'))
export class FriendsController {
	constructor(private readonly friendsService: FriendsService) {}

	// POST /friends/request/:id
	@Post('request/:id')
	async send(@Req() req, @Param('id') recipientId: string) {
		console.log('ID du demandeur dans le JWT :', req.user.userId); // Vérifie si c'est undefined !
		console.log('ID du destinataire :', recipientId);
		return this.friendsService.sendRequest(req.user.userId, recipientId);
	}

	@Get()
	async getMyFriends(@Req() req) {
	return this.friendsService.getMyFriends(req.user.userId);
	}

	// GET /friends/pending
	@Get('pending')
	async getPending(@Req() req) {
		return this.friendsService.getPendingRequests(req.user.userId);
	}

	// PATCH /friends/accept/:id
	@Patch('accept/:id')
	async accept(@Param('id') requestId: string, @Req() req) {
		return this.friendsService.acceptRequest(requestId, req.user.userId);
	}
}