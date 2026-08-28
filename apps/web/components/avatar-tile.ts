/**
 * Marks an avatar tile once the player's character image has actually arrived.
 *
 * The tile has to look like two different things depending on an outcome the
 * server cannot predict and CSS cannot observe. A player with a model should be
 * their character on transparency; a player without one — the great majority —
 * should be the coloured initial. Nothing renders the tile knows which it is:
 * the URL is derived from a player id alone (that is what lets one component
 * cover every listing without a fingerprint in a dozen API payloads), so
 * "do they have a model" is only answered by the image request itself.
 *
 * One capture-phase listener on the document, rather than a React client
 * component per tile. `load` does not bubble, so capture is the only way to
 * hear about it centrally — and it is the difference between one listener per
 * page and hydrating several hundred components in a leaderboard.
 *
 * `naturalWidth > 1` is the test, not the load/error split. A player with no
 * model is answered with a 1x1 transparent PNG, and while that carries a 404,
 * the body is a decodable image: chromium paints it and fires `load`. The
 * dimensions are the only signal an `<img>` can read, which is why the image
 * server sends a 1x1 rather than an empty body.
 *
 * Failure mode is the resting state: no JavaScript, no attribute, letter tile.
 */
export const AVATAR_TILE_SCRIPT = `(function(){
function m(i){var p=i.parentElement;if(!p)return;
if(i.naturalWidth>1)p.setAttribute('data-has-model','');else p.removeAttribute('data-has-model');}
function h(e){var t=e.target;if(t&&t.tagName==='IMG'&&t.hasAttribute('data-avatar'))m(t);}
document.addEventListener('load',h,true);document.addEventListener('error',h,true);
function s(){var l=document.querySelectorAll('img[data-avatar]');for(var i=0;i<l.length;i++)if(l[i].complete)m(l[i]);}
if(document.readyState!=='loading')s();else document.addEventListener('DOMContentLoaded',s);
})();`;
