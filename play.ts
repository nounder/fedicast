import { Actor, Follow, lookupObject, Person } from "jsr:@fedify/fedify"
import { federation } from "./federation.ts"
import { Create, Note, PUBLIC_COLLECTION } from "jsr:@fedify/fedify"

const ctx = federation.createContext({
	url: "https://rafael-air-m1.tail472f72.ts.net/users/me/outbox?cursor=",
} as Request)

const recipient = (await lookupObject(
	"https://activitypub.academy/@dobessia_rakdus"
)) as Actor

const me = "@me@rafael-air-m1.tail472f72.ts.net"

const actorUri = ctx.getActorUri(me)

await ctx.sendActivity(
	{ handle: me },
	recipient,
	new Create({
		actor: ctx.getActorUri(me),
		to: PUBLIC_COLLECTION,
		object: new Note({
			attribution: ctx.getActorUri(me),
			to: PUBLIC_COLLECTION,
		}),
	}),
	{ immediate: true, preferSharedInbox: true }
)
console.log("sent")
