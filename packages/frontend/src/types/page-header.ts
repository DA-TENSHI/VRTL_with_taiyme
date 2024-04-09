/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

export type PageHeaderItem = {
	text: string;
	icon: string;
	highlighted?: boolean;
	asFullButton?: boolean;
	handler: (ev: MouseEvent) => void;
};