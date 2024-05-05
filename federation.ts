import {
	Accept,
	Article,
	Create,
	exportJwk,
	Federation,
	Follow,
	generateCryptoKeyPair,
	Image,
	importJwk,
	MemoryKvStore,
	Note,
	Person,
} from "jsr:@fedify/fedify"
import { DenoKvMessageQueue, DenoKvStore } from "jsr:@fedify/fedify/x/denokv"
import { KV } from "./store.ts"
import { requestNeynar } from "./farcaster.ts"

const federation = new Federation({
	kv: new DenoKvStore(KV),
	queue: new DenoKvMessageQueue(KV),
	treatHttps: true,
})

federation
	.setInboxListeners("/users/{handle}/inbox", "/inbox")
	.on(Follow, async (ctx, follow) => {
		console.log("Follow:", follow)

		if (follow.id == null || follow.actorId == null || follow.objectId == null) {
			return
		}
		const handle = ctx.getHandleFromActorUri(follow.objectId)

		if (handle !== "me") return

		const follower = await follow.getActor(ctx)

		await ctx.sendActivity(
			{ handle },
			follower,
			new Accept({ actor: follow.objectId, object: follow })
		)
	})

federation
	.setActorDispatcher("/users/{handle}", async (ctx, handle, key) => {
		return new Person({
			id: ctx.getActorUri(handle),
			name: "Me",
			summary: "This is me!",
			preferredUsername: handle,
			icon: new Image({
				url: new URL(`https://picsum.photos/seed/${handle}/200/200`),
			}),
			url: new URL("/", ctx.url),
			inbox: ctx.getInboxUri(handle), // Inbox URI
			publicKey: key, // generated in setKeyPairDispatched
		})
	})
	.setKeyPairDispatcher(async (ctx, handle) => {
		const storeKey = ["keys", handle]
		const entry = await KV.get<{ privateKey: unknown; publicKey: unknown }>(
			storeKey
		)

		if (entry == null || entry.value == null) {
			const { privateKey, publicKey } = await generateCryptoKeyPair()

			await KV.set(storeKey, {
				privateKey: await exportJwk(privateKey),
				publicKey: await exportJwk(publicKey),
			})

			return { privateKey, publicKey }
		}
		const privateKey = await importJwk(entry.value.privateKey, "private")
		const publicKey = await importJwk(entry.value.publicKey, "public")

		return { privateKey, publicKey }
	})

const ItemCountPerPage = 100

federation
	.setOutboxDispatcher("/users/{handle}/outbox", async (ctx, handle, cursor) => {
		const res = await requestNeynar(
			"feed?feed_type=following&fid=3&with_recasts=false&limit=100" +
				"&cursor=" +
				cursor
		)

		const items = res.casts.map(
			(cast) =>
				new Create({
					id: new URL(`/casts/${cast.hash}#activity`, ctx.url),
					actor: ctx.getActorUri(handle),
					object: new Note({
						id: new URL(`/casts/${cast.hash}`, ctx.url),
						content: cast.text,
						published: Temporal.Instant.from(cast.timestamp),
					}),
				})
		)
		return { items, nextCursor: res.next?.cursor || null }
	})
	.setFirstCursor((ctx, handle) => {
		return ""
	})

export { federation }
