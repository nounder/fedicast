import { federation } from "./federation.ts"
import * as shed from "shed"
import { Postgres } from "./postgres.ts"
import { appRecovery } from "./middleware.ts"

const router = new shed.WorkerRouter()

router.get("users/:handle/followers", (req, ctx) => {
	const { handle } = ctx.match.pathname.groups

	return new shed.JSONResponse({
		followers: [],
	})
})

router.any("*", (req, ctx) => {
	return federation.fetch(req, {
		contextData: undefined,
	})
})

router.recover("*", appRecovery)

Deno.serve(router.serveCallback)
