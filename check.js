// Sanity check for data.js: node check.js
const assert = require('assert');
const { sites, species } = require('./data.js');
const S = new Map(species.map(s => [s.id, s]));
const TYPES = 'fish shark ray turtle whale eel jelly squid octopus cuttle seahorse nautilus siphonophore pyrosome crust cuke star nudi sunfish clam xeno brain table branch fan anemone sponge softcoral black glass bamboo crinoid seapen mushroom massive scroll bubble leather cups whip digitate grass algae tubes xmas'.split(' ');
assert.strictEqual(S.size, species.length, 'duplicate species id');
for (const s of species) {
  assert(TYPES.includes(s.type), `${s.id}: bad type ${s.type}`);
  assert(['pelagic', 'reef', 'benthic'].includes(s.hab), `${s.id}: hab`);
  assert(s.depth[0] < s.depth[1], `${s.id}: depth`);
  if (s.typ) assert(s.typ[0] >= s.depth[0] && s.typ[1] <= s.depth[1], `${s.id}: typ outside depth`);
  assert(s.regions === 'all' || (s.regions === 'world' && s.range) || (Array.isArray(s.regions) && s.regions.every(r => ['MV', 'EG', 'ID', 'AU', 'PW'].includes(r))), `${s.id}: regions`);
  assert(['LC', 'NT', 'VU', 'EN', 'CR', 'DD', 'NE'].includes(s.iucn), `${s.id}: iucn`);
  assert(!s.mood || ['curious', 'puff', 'hide'].includes(s.mood), `${s.id}: mood`);
  assert(s.host || s.lair || s.ab > 0, `${s.id}: needs ab`);
  assert(!s.lair || s.lair.every(l => ['station', 'cave', 'wreck', 'overhang'].includes(l)), `${s.id}: lair`);
  assert(s.name && s.sci && s.fact && s.c && s.size > 0, `${s.id}: missing field`);
}
for (const site of sites) { for (const id of Object.keys(site.featured)) assert(S.get(id), `${site.id}: unknown featured ${id}`); assert(!site.layout || ['caves', 'thila', 'wreck'].includes(site.layout), `${site.id}: layout`); if (site.target) assert(S.get(site.target.id), `${site.id}: unknown target`); }
const native = species.filter(s => s.regions === 'all' || (Array.isArray(s.regions) && s.regions.includes('MV'))).length;
console.log(`ok: ${sites.length} Maldives sites, ${species.length} species (${native} native to the Maldives)`);
