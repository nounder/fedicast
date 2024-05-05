import { JSONResponse, Context, Awaitable, ErrorContext, Handler } from "shed"

function renderError(error: any, init: ResponseInit) {
	const errorFields = ["message"]

	// TODO : Remove this in production
	if (true) {
		errorFields.push("stack")
	}

	const serializedError = errorFields.reduce((a, f) => {
		a[f] = error[f]

		return a
	}, {})

	console.error(`${error.name || "Error"}: ${error.message}`, error.stack)

	return new JSONResponse({ error: serializedError }, init, null, "\t")
}

export const appRecovery: Handler<ErrorContext> = (
	_req: Request,
	{ error, response }
) => {
	console.error(error)

	return renderError(error, response)
}
