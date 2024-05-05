import { Context, Create, Image, Note, RequestContext } from "jsr:@fedify/fedify"

const NEYNAR_API_KEY = Deno.env.get("NEYNAR_API_KEY")

if (!NEYNAR_API_KEY) {
	throw new Error("NEYNAR_API_KEY is not set")
}

const BaseNeynarHeaders = {
	accept: "application/json",
	api_key: NEYNAR_API_KEY,
}

const NeynarBaseURL = `https://api.neynar.com`

export async function requestNeynar(path) {
	const url = new URL(path, NeynarBaseURL)

	const res = await fetch(url, {
		headers: BaseNeynarHeaders,
	}).then((response) => response.json())

	console.log(res)

	return res
}

export async function makeFeedActivities(
	ctx: RequestContext<any>,
	handle,
	limit = 50
) {
	const user = await requestNeynar(
		`/v1/farcaster/user-by-username?username=${handle}`
	).then((v) => v.result.user)
	const casts = await requestNeynar(
		`/v1/farcaster/casts?&fid=${user.fid}&limit=${limit}`
	).then((v) => v.result.casts)

	const items = casts.map((cast) => {
		const images = cast.embeds
			.map((embed) => {
				if (
					embed.url?.endsWith(".jpg") ||
					embed.url?.endsWith(".png") ||
					embed.url?.includes("imagedelivery.net")
				) {
					return new Image({
						url: new URL(embed.url),
					})
				}
			})
			.filter(Boolean)

		return new Create({
			id: new URL(`/casts/${cast.hash}#activity`, ctx.url),
			actor: ctx.getActorUri(handle),
			to: new URL("https://www.w3.org/ns/activitystreams#Public"),
			cc: ctx.getFollowersUri(handle),
			published: Temporal.Instant.from(cast.timestamp),
			object: new Note({
				id: new URL(`/casts/${cast.hash}`, ctx.url),
				content: cast.text,
				published: Temporal.Instant.from(cast.timestamp),
				sensitive: false,
				attachments: [...images],
			}),
		})
	})

	return {
		items,

		async send(recipients: any = "followers") {
			for (const activity of items.toReversed()) {
				await ctx.sendActivity({ handle }, recipients, activity, {
					preferSharedInbox: true,
					immediate: true,
				})
			}
		},
	}
}
