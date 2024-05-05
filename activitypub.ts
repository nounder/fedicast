import {
	Actor,
	Context,
	Create,
	Note,
	PUBLIC_COLLECTION,
} from "jsr:@fedify/fedify"

async function sendNote(
	ctx: Context<void>,
	senderHandle: string,
	recipient: Actor
) {
	await ctx.sendActivity(
		{ handle: senderHandle },
		recipient,
		new Create({
			actor: ctx.getActorUri(senderHandle),
			to: PUBLIC_COLLECTION,
			object: new Note({
				attribution: ctx.getActorUri(senderHandle),
				to: PUBLIC_COLLECTION,
			}),
		}),
		{ preferSharedInbox: true }
	)
}
