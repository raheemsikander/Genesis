/**
 * Do NOT use `new File(...)` here: RN's `File.name` is a
 * prototype getter with no setter, and Expo's FormData patch assigns
 * `value.name = ...` when oRPC appends the file, which throws on Hermes
 * ("Cannot assign to property 'name' which has only a getter"). Instead, pass
 * an RN Blob with `name` as a writable own property; expo/fetch reads it for
 * the multipart content-disposition filename, so the server still receives
 * the real file name.
 */
export function toUploadFile(
	blob: Blob,
	name: string,
	type: string,
): Blob & { name: string } {
	const typed = type && blob.type !== type ? new Blob([blob], { type }) : blob;
	return Object.assign(typed, { name });
}
