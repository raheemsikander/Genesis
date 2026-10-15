/**
 * Read a local file URI (e.g. from expo-document-picker) into a Blob.
 *
 * Why not `(await fetch(uri)).blob()`: since SDK 56 the global `fetch` is
 * `expo/fetch`, whose `blob()` does `new Blob([arrayBuffer])` while the global
 * `Blob` is still React Native's, whose constructor rejects ArrayBuffer parts
 * ("Creating blobs from 'ArrayBuffer' and 'ArrayBufferView' are not
 * supported"). XHR goes through RN's networking stack, which backs the
 * response with a native blob, so no ArrayBuffer is ever materialised.
 */
export function uriToBlob(uri: string): Promise<Blob> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.onload = () => resolve(xhr.response as Blob);
		xhr.onerror = () => reject(new Error("Could not read the picked file"));
		xhr.responseType = "blob";
		xhr.open("GET", uri, true);
		xhr.send(null);
	});
}
