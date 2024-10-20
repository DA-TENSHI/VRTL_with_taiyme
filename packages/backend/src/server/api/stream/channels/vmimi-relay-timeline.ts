/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Injectable } from '@nestjs/common';
import type { Packed } from '@/misc/json-schema.js';
import { MetaService } from '@/core/MetaService.js';
import { VmimiRelayService } from '@/core/VmimiRelayService.js';
import { NoteEntityService } from '@/core/entities/NoteEntityService.js';
import { bindThis } from '@/decorators.js';
import { RoleService } from '@/core/RoleService.js';
import { isRenotePacked, isQuotePacked } from '@/misc/is-renote.js';
import type { JsonObject } from '@/misc/json-value.js';
import Channel, { type MiChannelService } from '../channel.js';

class VmimiRelayTimelineChannel extends Channel {
	public readonly chName = 'vmimiRelayTimeline';
	public static shouldShare = false;
	public static requireCredential = false as const;
	private withRenotes: boolean;
	private withReplies: boolean;
	private withFiles: boolean;

	constructor(
		private metaService: MetaService,
		private roleService: RoleService,
		private noteEntityService: NoteEntityService,
		private vmimiRelayService: VmimiRelayService,

		id: string,
		connection: Channel['connection'],
	) {
		super(id, connection);
		//this.onNote = this.onNote.bind(this);
	}

	@bindThis
	public async init(params: JsonObject) {
		const policies = await this.roleService.getUserPolicies(this.user ? this.user.id : null);
		if (!policies.gtlAvailable) return;

		this.withRenotes = !!(params.withRenotes ?? true);
		this.withReplies = !!(params.withReplies ?? true);
		this.withFiles = !!(params.withFiles ?? false);

		// Subscribe events
		this.subscriber.on('notesStream', this.onNote);
	}

	@bindThis
	private async onNote(note: Packed<'Note'>) {
		if (this.withFiles && (note.fileIds == null || note.fileIds.length === 0)) return;

		if (note.visibility !== 'public') return;
		if (note.channelId != null) return;
		if (!this.vmimiRelayService.isRelayedInstance(note.user.host ?? null)) return;

		if (isRenotePacked(note) && !isQuotePacked(note) && !this.withRenotes) return;

		if (this.isNoteMutedOrBlocked(note)) return;

		if (this.user && isRenotePacked(note) && !isQuotePacked(note)) {
			if (note.renote && Object.keys(note.renote.reactions).length > 0) {
				const myRenoteReaction = await this.noteEntityService.populateMyReaction(note.renote, this.user.id);
				note.renote.myReaction = myRenoteReaction;
			}
		}

		if (note.reply && this.user && !this.following[note.userId]?.withReplies && !this.withReplies) {
			const reply = note.reply;
			if (reply.userId !== this.user.id && note.userId !== this.user.id && reply.userId !== note.userId) return;
		}

		this.connection.cacheNote(note);

		this.send('note', note);
	}

	@bindThis
	public dispose() {
		// Unsubscribe events
		this.subscriber.off('notesStream', this.onNote);
	}
}

@Injectable()
export class VmimiRelayTimelineChannelService implements MiChannelService<false> {
	public readonly shouldShare = VmimiRelayTimelineChannel.shouldShare;
	public readonly requireCredential = VmimiRelayTimelineChannel.requireCredential;
	public readonly kind = VmimiRelayTimelineChannel.kind;

	constructor(
		private metaService: MetaService,
		private roleService: RoleService,
		private noteEntityService: NoteEntityService,
		private vmimiRelayService: VmimiRelayService,
	) {
	}

	@bindThis
	public create(id: string, connection: Channel['connection']): VmimiRelayTimelineChannel {
		return new VmimiRelayTimelineChannel(
			this.metaService,
			this.roleService,
			this.noteEntityService,
			this.vmimiRelayService,
			id,
			connection,
		);
	}
}
