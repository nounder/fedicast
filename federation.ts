import {
	Accept,
	Article,
	Create,
	Endpoints,
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
import { requestNeynar, makeFeedActivities } from "./farcaster.ts"

const federation = new Federation({
	kv: new DenoKvStore(KV),
	queue: new DenoKvMessageQueue(KV),
	treatHttps: true,
	onOutboxError: (error, activity) => {
		console.error("Failed to deliver an activity:", error)
		console.error("Activity:", activity)
	},
})

federation
	.setInboxListeners("/users/{handle}/inbox", "/inbox")
	.on(Follow, async (ctx, follow) => {
		console.log("Follow:", follow)

		if (follow.id == null || follow.actorId == null || follow.objectId == null) {
			return
		}

		const handle = ctx.getHandleFromActorUri(follow.objectId)
		const follower = await follow.getActor(ctx)

		// automatically accept follow
		await ctx.sendActivity(
			{ handle },
			follower,
			new Accept({ actor: follow.objectId, object: follow })
		)

		await KV.set(["followers", handle, follow.actorId.href], {})

		const feed = await makeFeedActivities(ctx, handle)
		await feed.send(follower)
	})
	.onError(async (ctx, error) => {
		console.error(error)
	})

federation
	.setActorDispatcher("/users/{handle}", async (ctx, handle, key) => {
		const res = await requestNeynar(
			`/v1/farcaster/user-by-username?username=${handle}`
		).then((v) => v.result.user)

		const pfpUrl = res.pfp?.url

		return new Person({
			id: ctx.getActorUri(handle),
			name: res.displayName,
			summary: res.profile.bio?.text || "",
			preferredUsername: handle,
			icon: pfpUrl
				? new Image({
						url: new URL(
							"https://wrpcd.net/cdn-cgi/image/fit=contain,f=auto,w=144/" +
								pfpUrl
						),
					})
				: null,
			image: new Image({
				url: new URL(
					"https://wrpcd.net/cdn-cgi/image/fit=contain,f=auto,w=1500/" +
						"https://i.imgur.com/PVc67AW.png"
				),
			}),
			discoverable: true,
			indexable: true,
			url: new URL("/", ctx.url),
			inbox: ctx.getInboxUri(handle),
			outbox: ctx.getOutboxUri(handle),
			publicKey: key,

			followers: ctx.getFollowersUri(handle),

			endpoints: new Endpoints({
				sharedInbox: ctx.getInboxUri(),
			}),
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

federation.setFollowersDispatcher(
	"/users/{handle}/followers",
	async (ctx, handle, cursor) => {
		const followers = []

		for await (const entry of KV.list({ prefix: ["followers", handle] })) {
			const follower = entry.key[2] as string

			followers.push(new URL(follower))
		}

		return { items: followers, nextCursor: null }
	}
)

federation
	.setOutboxDispatcher("/users/{handle}/outbox", async (ctx, handle, cursor) => {
		const res = await requestNeynar(
			"/v2/farcaster/feed?feed_type=following&fid=3&with_recasts=false&limit=10" +
				"&cursor=" +
				cursor
		)

		const { items } = await makeFeedActivities(ctx, handle)

		return { items, nextCursor: res.next?.cursor || null }
	})
	.setFirstCursor((ctx, handle) => {
		return ""
	})
	.setCounter(async () => 50)

export { federation }
