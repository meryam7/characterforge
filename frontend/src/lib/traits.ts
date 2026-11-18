/** Character traits catalogue: the ONE source of truth for the character builder.
 * Used by the browser (builder UI, preview art) AND the server (server/routes/characters.ts validates against it,
 * server/ai.ts turns choices into the AI prompt). Pure data + pure functions: no imports, no DOM.
 * Option = [id, English label, French label, prompt words (English: the models understand English best), swatch hex?].
 * Ids are stored in the DB (characters.traits JSON): never rename one, add new ids instead. */

export type Opt = { id: string; en: string; fr: string; p: string; hex?: string }
export type GroupKind = 'single' | 'color' | 'multi'
export type SectionId = 'identity' | 'body' | 'skin' | 'face' | 'hair' | 'outfit' | 'extras'
export type Group = { id: string; section: SectionId; en: string; fr: string; kind: GroupKind; max?: number; options: Opt[] }
export type Traits = Record<string, string | string[]>

type Row = [string, string, string, string, string?]
const opts = (rows: Row[]): Opt[] => rows.map(([id, en, fr, p, hex]) => ({ id, en, fr, p, hex }))
const group = (id: string, section: SectionId, en: string, fr: string, kind: GroupKind, rows: Row[], max?: number): Group =>
  ({ id, section, en, fr, kind, max, options: opts(rows) })

export const SECTIONS: { id: SectionId; en: string; fr: string }[] = [
  { id: 'identity', en: 'Identity', fr: 'Identité' },
  { id: 'body', en: 'Body', fr: 'Corps' },
  { id: 'skin', en: 'Skin', fr: 'Peau' },
  { id: 'face', en: 'Face', fr: 'Visage' },
  { id: 'hair', en: 'Hair', fr: 'Cheveux' },
  { id: 'outfit', en: 'Outfit', fr: 'Tenue' },
  { id: 'extras', en: 'Extras', fr: 'Extras' },
]

const OUTFIT_COLORS: Row[] = [
  ['black', 'Black', 'Noir', 'black', '#1c1c22'],
  ['white', 'White', 'Blanc', 'white', '#f4f4f6'],
  ['grey', 'Grey', 'Gris', 'grey', '#8a8d96'],
  ['red', 'Red', 'Rouge', 'red', '#c62828'],
  ['crimson', 'Crimson', 'Cramoisi', 'crimson', '#8e1330'],
  ['orange', 'Orange', 'Orange', 'orange', '#ef7d1a'],
  ['gold', 'Gold', 'Or', 'gold', '#d4a72c'],
  ['yellow', 'Yellow', 'Jaune', 'yellow', '#f2cf3b'],
  ['olive', 'Olive', 'Olive', 'olive green', '#6b7a2a'],
  ['green', 'Green', 'Vert', 'green', '#2e8b46'],
  ['emerald', 'Emerald', 'Émeraude', 'emerald green', '#0f7a5a'],
  ['teal', 'Teal', 'Bleu canard', 'teal', '#14837f'],
  ['sky', 'Sky blue', 'Bleu ciel', 'sky blue', '#5fb0e8'],
  ['blue', 'Blue', 'Bleu', 'blue', '#2b5fc4'],
  ['navy', 'Navy', 'Marine', 'navy blue', '#1d2c5e'],
  ['purple', 'Purple', 'Violet', 'purple', '#6a3aa8'],
  ['lavender', 'Lavender', 'Lavande', 'lavender', '#b9a3e3'],
  ['pink', 'Pink', 'Rose', 'pink', '#e77fae'],
  ['brown', 'Brown', 'Marron', 'brown', '#6e4b2e'],
  ['beige', 'Beige', 'Beige', 'beige', '#d9c3a0'],
  ['silver', 'Silver', 'Argent', 'silver', '#c0c4cc'],
]

export const GROUPS: Group[] = [
  // ---------------------------------------------------------------- identity
  group('gender', 'identity', 'Gender', 'Genre', 'single', [
    ['female', 'Female', 'Féminin', 'female'],
    ['male', 'Male', 'Masculin', 'male'],
    ['nonbinary', 'Non-binary', 'Non-binaire', 'androgynous'],
  ]),
  group('age', 'identity', 'Age', 'Âge', 'single', [
    ['child', 'Child', 'Enfant', 'young child'],
    ['teen', 'Teen', 'Adolescent', 'teenage'],
    ['young', 'Young adult', 'Jeune adulte', 'young adult'],
    ['adult', 'Adult', 'Adulte', 'adult'],
    ['middle', 'Middle-aged', "D'âge mûr", 'middle-aged'],
    ['elder', 'Elderly', 'Âgé', 'elderly'],
  ]),
  group('species', 'identity', 'Species', 'Espèce', 'single', [
    ['human', 'Human', 'Humain', 'human'],
    ['elf', 'Elf', 'Elfe', 'elf'],
    ['dwarf', 'Dwarf', 'Nain', 'dwarf'],
    ['orc', 'Orc', 'Orque', 'orc'],
    ['demon', 'Demon', 'Démon', 'demon'],
    ['angel', 'Angel', 'Ange', 'angel'],
    ['vampire', 'Vampire', 'Vampire', 'vampire'],
    ['android', 'Android', 'Androïde', 'android robot'],
    ['catfolk', 'Cat-folk', 'Homme-chat', 'catgirl/catboy with cat ears and tail'],
    ['foxfolk', 'Fox-folk', 'Homme-renard', 'kitsune with fox ears and fluffy tail'],
    ['wolffolk', 'Wolf-folk', 'Homme-loup', 'wolf-kin with wolf ears and tail'],
    ['dragonkin', 'Dragon-kin', 'Homme-dragon', 'dragonborn with scales and horns'],
    ['merfolk', 'Merfolk', 'Sirène / triton', 'merfolk with fins'],
    ['fairy', 'Fairy', 'Fée', 'fairy with translucent wings'],
    ['undead', 'Undead', 'Mort-vivant', 'undead'],
  ]),
  group('personality', 'identity', 'Personality (vibe)', 'Personnalité (allure)', 'multi', [
    ['brave', 'Brave', 'Courageux', 'brave'],
    ['kind', 'Kind', 'Bienveillant', 'kind-looking'],
    ['mysterious', 'Mysterious', 'Mystérieux', 'mysterious'],
    ['cheerful', 'Cheerful', 'Joyeux', 'cheerful'],
    ['cold', 'Cold', 'Froid', 'cold and distant'],
    ['wise', 'Wise', 'Sage', 'wise'],
    ['rebellious', 'Rebellious', 'Rebelle', 'rebellious'],
    ['elegant', 'Elegant', 'Élégant', 'elegant'],
    ['playful', 'Playful', 'Espiègle', 'playful'],
    ['menacing', 'Menacing', 'Menaçant', 'menacing'],
  ], 3),
  // ---------------------------------------------------------------- body
  group('height', 'body', 'Height', 'Taille', 'single', [
    ['tiny', 'Very short', 'Très petit', 'very short'],
    ['short', 'Short', 'Petit', 'short'],
    ['average', 'Average', 'Moyen', 'average height'],
    ['tall', 'Tall', 'Grand', 'tall'],
    ['towering', 'Very tall', 'Très grand', 'very tall'],
  ]),
  group('build', 'body', 'Body shape', 'Silhouette', 'single', [
    ['slim', 'Slim', 'Mince', 'slim build'],
    ['slender', 'Slender', 'Élancé', 'slender build'],
    ['average', 'Average', 'Moyenne', 'average build'],
    ['athletic', 'Athletic', 'Athlétique', 'athletic build'],
    ['muscular', 'Muscular', 'Musclé', 'muscular build'],
    ['curvy', 'Curvy', 'Pulpeux', 'curvy figure'],
    ['stocky', 'Stocky', 'Trapu', 'stocky build'],
    ['plus', 'Plus-size', 'Grande taille', 'plus-size build'],
    ['lanky', 'Lanky', 'Dégingandé', 'lanky build'],
  ]),
  group('pose', 'body', 'Pose', 'Pose', 'single', [
    ['standing', 'Standing', 'Debout', 'standing pose'],
    ['heroic', 'Heroic', 'Héroïque', 'heroic pose'],
    ['action', 'Action', 'Action', 'dynamic action pose'],
    ['casting', 'Casting a spell', 'Lance un sort', 'casting a spell'],
    ['arms-crossed', 'Arms crossed', 'Bras croisés', 'arms crossed'],
    ['waving', 'Waving', "Fait coucou", 'waving'],
    ['relaxed', 'Relaxed', 'Détendu', 'relaxed pose, hands in pockets'],
  ]),
  // ---------------------------------------------------------------- skin
  group('skin', 'skin', 'Skin tone', 'Teint', 'color', [
    ['porcelain', 'Porcelain', 'Porcelaine', 'porcelain pale', '#f8e3d6'],
    ['fair', 'Fair', 'Clair', 'fair', '#f1cdb4'],
    ['light', 'Light', 'Rosé', 'light', '#e8b896'],
    ['beige', 'Beige', 'Beige', 'light beige', '#dcae86'],
    ['olive', 'Olive', 'Olivâtre', 'olive', '#c49a6c'],
    ['tan', 'Tan', 'Hâlé', 'tan', '#b98257'],
    ['golden', 'Golden brown', 'Brun doré', 'golden brown', '#a26a3f'],
    ['brown', 'Brown', 'Brun', 'brown', '#85532f'],
    ['deep', 'Deep brown', 'Brun foncé', 'deep brown', '#5e3a22'],
    ['ebony', 'Ebony', 'Ébène', 'very dark ebony', '#3b2417'],
    ['ashen', 'Ashen grey', 'Gris cendré', 'ashen grey', '#a3a5a8'],
    ['blue', 'Blue', 'Bleue', 'blue', '#6f9fd8'],
    ['green', 'Green', 'Verte', 'green', '#79a865'],
    ['purple', 'Purple', 'Violette', 'purple', '#9a78c4'],
    ['red', 'Red', 'Rouge', 'crimson red', '#c25450'],
    ['metal', 'Metallic', 'Métallique', 'metallic silver', '#b8bec7'],
  ]),
  group('skinDetails', 'skin', 'Skin details', 'Détails de peau', 'multi', [
    ['freckles', 'Freckles', 'Taches de rousseur', 'freckles'],
    ['mole', 'Beauty mark', 'Grain de beauté', 'beauty mark'],
    ['scar', 'Scars', 'Cicatrices', 'battle scars'],
    ['tattoos', 'Tattoos', 'Tatouages', 'tattoos'],
    ['birthmark', 'Birthmark', 'Tache de naissance', 'birthmark'],
    ['vitiligo', 'Vitiligo', 'Vitiligo', 'vitiligo'],
    ['runes', 'Glowing runes', 'Runes lumineuses', 'glowing runic markings'],
    ['scales', 'Scales', 'Écailles', 'patches of scales'],
    ['paint', 'Tribal paint', 'Peintures tribales', 'tribal face paint'],
  ], 4),
  // ---------------------------------------------------------------- face
  group('faceShape', 'face', 'Face shape', 'Forme du visage', 'single', [
    ['oval', 'Oval', 'Ovale', 'oval face'],
    ['round', 'Round', 'Rond', 'round face'],
    ['square', 'Square', 'Carré', 'square jaw'],
    ['heart', 'Heart', 'En cœur', 'heart-shaped face'],
    ['long', 'Long', 'Allongé', 'long face'],
    ['diamond', 'Diamond', 'Diamant', 'high cheekbones'],
    ['angular', 'Angular', 'Anguleux', 'sharp angular features'],
  ]),
  group('eyeColor', 'face', 'Eye colour', 'Couleur des yeux', 'color', [
    ['brown', 'Brown', 'Marron', 'brown', '#5b3a1e'],
    ['hazel', 'Hazel', 'Noisette', 'hazel', '#8e6b2f'],
    ['amber', 'Amber', 'Ambre', 'amber', '#c98a14'],
    ['green', 'Green', 'Vert', 'green', '#3f8f4a'],
    ['blue', 'Blue', 'Bleu', 'blue', '#3d7fd1'],
    ['grey', 'Grey', 'Gris', 'grey', '#8d97a3'],
    ['violet', 'Violet', 'Violet', 'violet', '#7c4dd1'],
    ['red', 'Red', 'Rouge', 'glowing red', '#c4202f'],
    ['gold', 'Gold', 'Doré', 'golden', '#e0b23a'],
    ['black', 'Black', 'Noir', 'black', '#16141a'],
    ['hetero', 'Two colours', 'Vairons', 'heterochromia, one blue eye and one gold eye', '#3d7fd1'],
  ]),
  group('eyeShape', 'face', 'Eye shape', 'Forme des yeux', 'single', [
    ['almond', 'Almond', 'En amande', 'almond-shaped'],
    ['round', 'Round', 'Ronds', 'big round'],
    ['hooded', 'Hooded', 'Paupières tombantes', 'hooded'],
    ['monolid', 'Monolid', 'Monopaupière', 'monolid'],
    ['upturned', 'Upturned', 'En amande relevée', 'upturned'],
    ['downturned', 'Downturned', 'Tombants', 'downturned'],
    ['sharp', 'Sharp', 'Perçants', 'sharp narrow'],
  ]),
  group('eyebrows', 'face', 'Eyebrows', 'Sourcils', 'single', [
    ['thin', 'Thin', 'Fins', 'thin eyebrows'],
    ['thick', 'Thick', 'Épais', 'thick eyebrows'],
    ['arched', 'Arched', 'Arqués', 'arched eyebrows'],
    ['straight', 'Straight', 'Droits', 'straight eyebrows'],
    ['bushy', 'Bushy', 'Broussailleux', 'bushy eyebrows'],
  ]),
  group('nose', 'face', 'Nose', 'Nez', 'single', [
    ['small', 'Small', 'Petit', 'small nose'],
    ['button', 'Button', 'En trompette', 'button nose'],
    ['straight', 'Straight', 'Droit', 'straight nose'],
    ['aquiline', 'Aquiline', 'Aquilin', 'aquiline nose'],
    ['wide', 'Wide', 'Large', 'wide nose'],
    ['pointed', 'Pointed', 'Pointu', 'pointed nose'],
  ]),
  group('lips', 'face', 'Lips', 'Lèvres', 'single', [
    ['thin', 'Thin', 'Fines', 'thin lips'],
    ['full', 'Full', 'Pulpeuses', 'full lips'],
    ['heart', 'Heart-shaped', 'En cœur', 'heart-shaped lips'],
    ['wide', 'Wide', 'Larges', 'wide mouth'],
  ]),
  group('facialHair', 'face', 'Facial hair', 'Pilosité faciale', 'single', [
    ['none', 'None', 'Aucune', 'clean-shaven'],
    ['stubble', 'Stubble', 'Barbe de 3 jours', 'stubble'],
    ['mustache', 'Mustache', 'Moustache', 'mustache'],
    ['goatee', 'Goatee', 'Bouc', 'goatee'],
    ['short', 'Short beard', 'Barbe courte', 'short beard'],
    ['full', 'Full beard', 'Barbe fournie', 'full beard'],
    ['long', 'Long beard', 'Longue barbe', 'long flowing beard'],
  ]),
  group('expression', 'face', 'Expression', 'Expression', 'single', [
    ['smile', 'Smiling', 'Souriant', 'warm smile'],
    ['smirk', 'Confident smirk', 'Sourire en coin', 'confident smirk'],
    ['serious', 'Serious', 'Sérieux', 'serious expression'],
    ['gentle', 'Gentle', 'Doux', 'gentle expression'],
    ['fierce', 'Fierce', 'Féroce', 'fierce expression'],
    ['shy', 'Shy', 'Timide', 'shy blushing expression'],
    ['mischief', 'Mischievous', 'Malicieux', 'mischievous grin'],
    ['sad', 'Melancholic', 'Mélancolique', 'melancholic expression'],
    ['angry', 'Angry', 'En colère', 'angry expression'],
  ]),
  group('makeup', 'face', 'Make-up', 'Maquillage', 'single', [
    ['none', 'None', 'Aucun', ''],
    ['natural', 'Natural', 'Naturel', 'natural makeup'],
    ['eyeliner', 'Bold eyeliner', 'Eye-liner marqué', 'bold winged eyeliner'],
    ['lipstick', 'Red lipstick', 'Rouge à lèvres', 'red lipstick'],
    ['gothic', 'Gothic', 'Gothique', 'dark gothic makeup'],
    ['glitter', 'Glitter', 'Paillettes', 'sparkling glitter makeup'],
  ]),
  // ---------------------------------------------------------------- hair
  group('hairColor', 'hair', 'Hair colour', 'Couleur des cheveux', 'color', [
    ['black', 'Black', 'Noir', 'black', '#17151a'],
    ['darkbrown', 'Dark brown', 'Châtain foncé', 'dark brown', '#3b2619'],
    ['brown', 'Brown', 'Châtain', 'brown', '#6a4428'],
    ['auburn', 'Auburn', 'Auburn', 'auburn', '#8a3b1f'],
    ['ginger', 'Ginger', 'Roux', 'ginger', '#c4561f'],
    ['strawberry', 'Strawberry blonde', 'Blond vénitien', 'strawberry blonde', '#d98b5f'],
    ['blonde', 'Blonde', 'Blond', 'golden blonde', '#e0b85a'],
    ['platinum', 'Platinum', 'Platine', 'platinum blonde', '#efe6c8'],
    ['white', 'White', 'Blanc', 'white', '#f3f3f3'],
    ['silver', 'Silver', 'Argenté', 'silver', '#b9bec6'],
    ['red', 'Red', 'Rouge', 'crimson red', '#b3122e'],
    ['pink', 'Pink', 'Rose', 'pastel pink', '#f19ac0'],
    ['purple', 'Purple', 'Violet', 'purple', '#7b46c2'],
    ['blue', 'Blue', 'Bleu', 'blue', '#2f6fd6'],
    ['teal', 'Teal', 'Turquoise', 'teal', '#169a95'],
    ['green', 'Green', 'Vert', 'green', '#38a04f'],
    ['ombre', 'Two-tone', 'Bicolore', 'two-tone ombre', '#7b46c2'],
  ]),
  group('hairLength', 'hair', 'Hair length', 'Longueur', 'single', [
    ['bald', 'Bald', 'Chauve', 'bald'],
    ['buzz', 'Buzz cut', 'Rasé court', 'buzz cut'],
    ['short', 'Short', 'Courts', 'short'],
    ['chin', 'Chin-length', 'Au menton', 'chin-length'],
    ['shoulder', 'Shoulder-length', 'Aux épaules', 'shoulder-length'],
    ['long', 'Long', 'Longs', 'long'],
    ['verylong', 'Very long', 'Très longs', 'very long'],
  ]),
  group('hairStyle', 'hair', 'Hairstyle', 'Coiffure', 'single', [
    ['straight', 'Straight', 'Lisses', 'straight'],
    ['wavy', 'Wavy', 'Ondulés', 'wavy'],
    ['curly', 'Curly', 'Bouclés', 'curly'],
    ['coily', 'Coily / afro', 'Crépus / afro', 'coily afro'],
    ['braids', 'Braids', 'Tresses', 'braided'],
    ['ponytail', 'Ponytail', 'Queue de cheval', 'ponytail'],
    ['twintails', 'Twin tails', 'Couettes', 'twin tails'],
    ['bun', 'Bun', 'Chignon', 'hair bun'],
    ['pixie', 'Pixie cut', 'Coupe pixie', 'pixie cut'],
    ['undercut', 'Undercut', 'Undercut', 'undercut'],
    ['mohawk', 'Mohawk', 'Crête', 'mohawk'],
    ['locs', 'Locs', 'Locks', 'dreadlocks'],
    ['messy', 'Messy', 'Décoiffés', 'messy spiky'],
    ['slicked', 'Slicked back', 'Plaqués', 'slicked back'],
    ['bangs', 'With bangs', 'Avec frange', 'with bangs'],
    ['hime', 'Hime cut', 'Coupe hime', 'hime cut'],
  ]),
  // ---------------------------------------------------------------- outfit
  group('outfit', 'outfit', 'Outfit style', 'Style de tenue', 'single', [
    ['casual', 'Casual', 'Décontracté', 'casual clothes, t-shirt and jeans'],
    ['street', 'Streetwear', 'Streetwear', 'streetwear, oversized hoodie'],
    ['school', 'School uniform', 'Uniforme scolaire', 'school uniform'],
    ['suit', 'Formal suit', 'Costume', 'tailored formal suit'],
    ['gown', 'Elegant gown', 'Robe de soirée', 'elegant ball gown'],
    ['adventurer', 'Adventurer', 'Aventurier', 'fantasy adventurer outfit, tunic and travel cloak'],
    ['knight', 'Knight armour', 'Armure de chevalier', 'full plate knight armor'],
    ['mage', 'Mage robes', 'Robe de mage', 'flowing mage robes'],
    ['rogue', 'Rogue leathers', 'Cuir de voleur', 'dark leather rogue outfit'],
    ['ranger', 'Ranger', 'Rôdeur', 'forest ranger outfit with hooded cloak'],
    ['samurai', 'Samurai', 'Samouraï', 'samurai armor'],
    ['ninja', 'Ninja', 'Ninja', 'ninja outfit'],
    ['kimono', 'Kimono', 'Kimono', 'traditional kimono'],
    ['scifi', 'Sci-fi suit', 'Combinaison SF', 'sleek sci-fi bodysuit'],
    ['cyberpunk', 'Cyberpunk', 'Cyberpunk', 'cyberpunk jacket with neon accents'],
    ['steampunk', 'Steampunk', 'Steampunk', 'steampunk outfit with brass goggles'],
    ['military', 'Military', 'Militaire', 'military uniform'],
    ['sport', 'Sporty', 'Sportif', 'sportswear'],
    ['gothic', 'Gothic', 'Gothique', 'gothic outfit with lace'],
    ['royal', 'Royal', 'Royal', 'royal regalia'],
    ['pirate', 'Pirate', 'Pirate', 'pirate captain outfit'],
    ['idol', 'Pop idol', 'Idole pop', 'pop idol stage costume'],
    ['wizard', 'Wizard', 'Magicien', 'wizard robe and pointed hat'],
    ['priest', 'Cleric', 'Prêtre', 'holy cleric vestments'],
  ]),
  group('mainColor', 'outfit', 'Main colour', 'Couleur principale', 'color', OUTFIT_COLORS),
  group('accentColor', 'outfit', 'Accent colour', "Couleur d'accent", 'color', OUTFIT_COLORS),
  group('footwear', 'outfit', 'Footwear', 'Chaussures', 'single', [
    ['boots', 'Boots', 'Bottes', 'leather boots'],
    ['sneakers', 'Sneakers', 'Baskets', 'sneakers'],
    ['sandals', 'Sandals', 'Sandales', 'sandals'],
    ['heels', 'Heels', 'Talons', 'high heels'],
    ['greaves', 'Armoured', 'Blindées', 'armored greaves'],
    ['barefoot', 'Barefoot', 'Pieds nus', 'barefoot'],
    ['loafers', 'Shoes', 'Chaussures de ville', 'dress shoes'],
  ]),
  group('accessories', 'outfit', 'Accessories', 'Accessoires', 'multi', [
    ['hat', 'Hat', 'Chapeau', 'hat'],
    ['hood', 'Hood', 'Capuche', 'hood'],
    ['cape', 'Cape', 'Cape', 'cape'],
    ['scarf', 'Scarf', 'Écharpe', 'scarf'],
    ['glasses', 'Glasses', 'Lunettes', 'glasses'],
    ['eyepatch', 'Eyepatch', 'Cache-œil', 'eyepatch'],
    ['earrings', 'Earrings', "Boucles d'oreilles", 'earrings'],
    ['necklace', 'Necklace', 'Collier', 'pendant necklace'],
    ['gloves', 'Gloves', 'Gants', 'gloves'],
    ['belt', 'Belt & pouches', 'Ceinture et sacoches', 'belt with pouches'],
    ['backpack', 'Backpack', 'Sac à dos', 'backpack'],
    ['headphones', 'Headphones', 'Casque audio', 'headphones'],
    ['crown', 'Crown / tiara', 'Couronne / diadème', 'crown'],
    ['mask', 'Mask', 'Masque', 'face mask'],
    ['flower', 'Flower in hair', 'Fleur dans les cheveux', 'flower in hair'],
    ['ribbon', 'Hair ribbon', 'Ruban', 'hair ribbon'],
  ], 4),
  // ---------------------------------------------------------------- extras
  group('features', 'extras', 'Fantasy features', 'Traits fantastiques', 'multi', [
    ['pointed-ears', 'Pointed ears', 'Oreilles pointues', 'pointed ears'],
    ['horns', 'Horns', 'Cornes', 'horns'],
    ['wings', 'Wings', 'Ailes', 'large wings'],
    ['tail', 'Tail', 'Queue', 'tail'],
    ['animal-ears', 'Animal ears', "Oreilles d'animal", 'animal ears'],
    ['halo', 'Halo', 'Auréole', 'glowing halo'],
    ['glow-eyes', 'Glowing eyes', 'Yeux lumineux', 'glowing eyes'],
    ['fangs', 'Fangs', 'Crocs', 'fangs'],
    ['cyber-arm', 'Cybernetic arm', 'Bras cybernétique', 'cybernetic arm'],
    ['aura', 'Magic aura', 'Aura magique', 'magical aura'],
  ], 3),
  group('held', 'extras', 'Holding', 'Tient', 'single', [
    ['none', 'Nothing', 'Rien', ''],
    ['sword', 'Sword', 'Épée', 'holding a sword'],
    ['greatsword', 'Greatsword', 'Épée à deux mains', 'holding a huge greatsword'],
    ['dagger', 'Daggers', 'Dagues', 'holding twin daggers'],
    ['staff', 'Magic staff', 'Bâton magique', 'holding a magic staff'],
    ['wand', 'Wand', 'Baguette', 'holding a wand'],
    ['bow', 'Bow', 'Arc', 'holding a bow'],
    ['spear', 'Spear', 'Lance', 'holding a spear'],
    ['shield', 'Shield', 'Bouclier', 'holding a shield'],
    ['book', 'Spellbook', 'Grimoire', 'holding a spellbook'],
    ['blaster', 'Blaster', 'Blaster', 'holding a sci-fi blaster'],
    ['lantern', 'Lantern', 'Lanterne', 'holding a lantern'],
    ['guitar', 'Guitar', 'Guitare', 'holding a guitar'],
    ['umbrella', 'Umbrella', 'Parapluie', 'holding an umbrella'],
    ['flowers', 'Bouquet', 'Bouquet', 'holding a bouquet of flowers'],
  ]),
  group('companion', 'extras', 'Companion', 'Compagnon', 'single', [
    ['none', 'None', 'Aucun', ''],
    ['cat', 'Cat', 'Chat', 'with a small cat companion'],
    ['dog', 'Dog', 'Chien', 'with a dog companion'],
    ['owl', 'Owl', 'Hibou', 'with an owl on the shoulder'],
    ['dragon', 'Baby dragon', 'Bébé dragon', 'with a tiny dragon companion'],
    ['fox', 'Fox', 'Renard', 'with a fox companion'],
    ['spirit', 'Floating spirit', 'Esprit flottant', 'with a floating spirit wisp'],
    ['robot', 'Little robot', 'Petit robot', 'with a small floating robot drone'],
  ]),
]

export const GROUP_BY_ID: Record<string, Group> = Object.fromEntries(GROUPS.map((g) => [g.id, g]))

const pick = (traits: Traits, id: string): Opt | undefined => {
  const v = traits[id]
  return typeof v === 'string' ? GROUP_BY_ID[id]?.options.find((o) => o.id === v) : undefined
}
const picks = (traits: Traits, id: string): Opt[] => {
  const v = traits[id]
  return Array.isArray(v) ? GROUP_BY_ID[id].options.filter((o) => v.includes(o.id)) : []
}
const words = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' ')

/** Validates untrusted input (server) or cleans state (browser). Returns null when nothing is chosen.
 * Throws Error(message) on anything unknown, so the server can answer 422. */
export function cleanTraits(raw: unknown): Traits | null {
  if (raw === undefined || raw === null) return null
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('traits: must be an object')
  const out: Traits = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const g = GROUP_BY_ID[key]
    if (!g) throw new Error(`traits: unknown trait "${key.slice(0, 40)}"`)
    const ids = new Set(g.options.map((o) => o.id))
    if (g.kind === 'multi') {
      if (!Array.isArray(value)) throw new Error(`traits.${key}: must be a list`)
      const list = [...new Set(value)]
      if (list.length > (g.max ?? 4)) throw new Error(`traits.${key}: at most ${g.max ?? 4} choices`)
      if (!list.every((v) => typeof v === 'string' && ids.has(v))) throw new Error(`traits.${key}: unknown choice`)
      if (list.length) out[key] = list as string[]
    } else if (value !== '' && value !== null) {
      if (typeof value !== 'string' || !ids.has(value)) throw new Error(`traits.${key}: unknown choice`)
      out[key] = value
    }
  }
  return Object.keys(out).length ? out : null
}

/** Turns choices into English prompt text. `main` = what defines the character (kept first, because SD 1.5's
 * text encoder only reads ~75 tokens), `details` = secondary touches added after the style. */
export function traitsPrompt(traits: Traits | null | undefined): { main: string; details: string } {
  if (!traits) return { main: '', details: '' }
  const species = pick(traits, 'species')
  const subject = words(pick(traits, 'age')?.p, pick(traits, 'gender')?.p, species?.p)
  const length = pick(traits, 'hairLength')
  const hairWords = words(length?.p, pick(traits, 'hairStyle')?.p, pick(traits, 'hairColor')?.p)
  const hair = length?.id === 'bald' ? 'bald' : hairWords && `${hairWords} hair`
  const eyeColor = pick(traits, 'eyeColor')
  const eyeWords = words(pick(traits, 'eyeShape')?.p, eyeColor?.p)
  const eyes = eyeColor?.id === 'hetero' ? eyeColor.p : eyeWords && `${eyeWords} eyes`
  const skin = pick(traits, 'skin') && `${pick(traits, 'skin')!.p} skin`
  const outfit = pick(traits, 'outfit')
  const c1 = pick(traits, 'mainColor')
  const c2 = pick(traits, 'accentColor')
  const colors = c1 && c2 && c1.id !== c2.id ? `${c1.p} and ${c2.p}` : c1?.p || c2?.p
  const clothes = outfit
    ? `wearing ${outfit.p}${colors ? ` in ${colors}` : ''}`
    : colors ? `${colors} clothes` : ''
  const body = [pick(traits, 'height')?.p, pick(traits, 'build')?.p].filter(Boolean).join(', ')

  const main = [
    subject && (species ? subject : `${subject} character`),
    skin, hair, eyes, clothes, body,
    pick(traits, 'expression')?.p,
    pick(traits, 'held')?.p,
    ...picks(traits, 'features').map((o) => o.p),
  ].filter(Boolean)
  const details = [
    pick(traits, 'faceShape')?.p,
    pick(traits, 'facialHair')?.p,
    ...picks(traits, 'accessories').map((o) => `${o.p}`),
    pick(traits, 'footwear')?.p,
    pick(traits, 'pose')?.p,
    pick(traits, 'companion')?.p,
    ...picks(traits, 'skinDetails').map((o) => o.p),
    pick(traits, 'eyebrows')?.p,
    pick(traits, 'nose')?.p,
    pick(traits, 'lips')?.p,
    pick(traits, 'makeup')?.p,
    ...picks(traits, 'personality').map((o) => o.p),
  ].filter(Boolean)
  return { main: main.join(', '), details: details.join(', ') }
}

/** Short human summary in the UI language, e.g. "Elf · Long wavy hair · Mage robes". */
export function traitsSummary(traits: Traits | null | undefined, lang: 'en' | 'fr', limit = 6): string[] {
  if (!traits) return []
  const label = (o: Opt) => (lang === 'fr' ? o.fr : o.en)
  const out: string[] = []
  for (const g of GROUPS) {
    const v = traits[g.id]
    const chosen = Array.isArray(v) ? picks(traits, g.id) : pick(traits, g.id) ? [pick(traits, g.id)!] : []
    const sep = lang === 'fr' ? ' : ' : ': '
    for (const o of chosen) if (o.p) out.push(g.kind === 'color' ? `${lang === 'fr' ? g.fr : g.en}${sep}${label(o)}` : label(o))
  }
  return out.slice(0, limit)
}

/** Swatch colour of a colour trait (for preview art), if chosen. */
export const traitHex = (traits: Traits | null | undefined, id: string): string | undefined =>
  traits ? pick(traits, id)?.hex : undefined
export const hasTrait = (traits: Traits | null | undefined, id: string, value: string): boolean => {
  const v = traits?.[id]
  return Array.isArray(v) ? v.includes(value) : v === value
}

/** "Surprise me": a coherent random character (mostly human-looking colours, sometimes fantasy). */
export function randomTraits(rand: () => number = Math.random): Traits {
  const one = (id: string, skipFirst = false) => {
    const o = GROUP_BY_ID[id].options
    return o[(skipFirst ? 1 : 0) + Math.floor(rand() * (o.length - (skipFirst ? 1 : 0)))].id
  }
  const some = (id: string, n: number) => {
    const o = [...GROUP_BY_ID[id].options]
    const out: string[] = []
    while (out.length < n && o.length) out.push(o.splice(Math.floor(rand() * o.length), 1)[0].id)
    return out
  }
  const fantasy = rand() < 0.35
  const naturalSkin = GROUP_BY_ID.skin.options.slice(0, 10)
  const t: Traits = {
    gender: one('gender'),
    age: ['teen', 'young', 'young', 'adult', 'adult', 'middle', 'elder'][Math.floor(rand() * 7)],
    species: fantasy ? one('species', true) : 'human',
    height: one('height'),
    build: one('build'),
    pose: one('pose'),
    skin: naturalSkin[Math.floor(rand() * naturalSkin.length)].id,
    faceShape: one('faceShape'),
    eyeColor: one('eyeColor'),
    eyeShape: one('eyeShape'),
    expression: one('expression'),
    hairColor: one('hairColor'),
    hairLength: one('hairLength'),
    hairStyle: one('hairStyle'),
    outfit: one('outfit'),
    mainColor: one('mainColor'),
    accentColor: one('accentColor'),
    footwear: one('footwear'),
    held: one('held'),
  }
  if (rand() < 0.6) t.accessories = some('accessories', 1 + Math.floor(rand() * 2))
  if (rand() < 0.4) t.skinDetails = some('skinDetails', 1)
  if (rand() < 0.5) t.personality = some('personality', 2)
  if (fantasy && rand() < 0.6) t.features = some('features', 1 + Math.floor(rand() * 2))
  if (t.gender !== 'female' && t.age !== 'child' && t.age !== 'teen' && rand() < 0.5) t.facialHair = one('facialHair', true)
  if (t.hairLength === 'bald') delete t.hairStyle
  return t
}
