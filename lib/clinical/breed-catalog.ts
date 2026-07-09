/**
 * Hand-curated breed catalog for the pet form's breed combobox.
 *
 * Sources: AKC + UKC recognized breeds (dogs), CFA + TICA recognized breeds
 * (cats), augmented with the most common designer mixes seen in US shelters.
 * Order within a species group is alphabetical, except "Mixed breed" and
 * "Unknown" are surfaced first because they're the highest-frequency picks
 * in adoption flows.
 *
 * The combobox accepts free text — if a user types something not in the
 * catalog, they can still submit it. This list is for ergonomic
 * autocomplete, not a strict allowlist.
 */

export type BreedEntry = {
  name: string;
  species: "dog" | "cat" | "other";
  /**
   * Alternate names / search terms that should match this breed.
   * Used so "lab" matches "Labrador Retriever", etc.
   */
  aliases?: string[];
};

export const BREEDS: BreedEntry[] = [
  // Top of list — generic / unknown options
  { name: "Mixed breed", species: "dog", aliases: ["mutt", "mix"] },
  { name: "Unknown", species: "dog" },

  // Dogs — AKC + UKC recognized + popular designer mixes
  { name: "Affenpinscher", species: "dog" },
  { name: "Afghan Hound", species: "dog" },
  { name: "Airedale Terrier", species: "dog" },
  { name: "Akita", species: "dog" },
  { name: "Alaskan Klee Kai", species: "dog" },
  { name: "Alaskan Malamute", species: "dog" },
  { name: "American Bulldog", species: "dog" },
  { name: "American Eskimo Dog", species: "dog" },
  { name: "American Foxhound", species: "dog" },
  { name: "American Hairless Terrier", species: "dog" },
  { name: "American Pit Bull Terrier", species: "dog", aliases: ["pit bull", "pitbull"] },
  { name: "American Staffordshire Terrier", species: "dog", aliases: ["amstaff"] },
  { name: "American Water Spaniel", species: "dog" },
  { name: "Anatolian Shepherd Dog", species: "dog" },
  { name: "Aussiedoodle", species: "dog" },
  { name: "Australian Cattle Dog", species: "dog", aliases: ["blue heeler", "red heeler"] },
  { name: "Australian Kelpie", species: "dog" },
  { name: "Australian Shepherd", species: "dog", aliases: ["aussie"] },
  { name: "Australian Terrier", species: "dog" },
  { name: "Basenji", species: "dog" },
  { name: "Basset Hound", species: "dog" },
  { name: "Beagle", species: "dog" },
  { name: "Bearded Collie", species: "dog" },
  { name: "Beauceron", species: "dog" },
  { name: "Bedlington Terrier", species: "dog" },
  { name: "Belgian Malinois", species: "dog", aliases: ["mali"] },
  { name: "Belgian Sheepdog", species: "dog" },
  { name: "Belgian Tervuren", species: "dog" },
  { name: "Bernedoodle", species: "dog" },
  { name: "Bernese Mountain Dog", species: "dog", aliases: ["berner"] },
  { name: "Bichon Frise", species: "dog" },
  { name: "Black and Tan Coonhound", species: "dog" },
  { name: "Black Russian Terrier", species: "dog" },
  { name: "Bloodhound", species: "dog" },
  { name: "Bluetick Coonhound", species: "dog" },
  { name: "Boerboel", species: "dog" },
  { name: "Border Collie", species: "dog" },
  { name: "Border Terrier", species: "dog" },
  { name: "Borzoi", species: "dog" },
  { name: "Boston Terrier", species: "dog" },
  { name: "Bouvier des Flandres", species: "dog" },
  { name: "Boxer", species: "dog" },
  { name: "Boykin Spaniel", species: "dog" },
  { name: "Briard", species: "dog" },
  { name: "Brittany", species: "dog" },
  { name: "Brussels Griffon", species: "dog" },
  { name: "Bull Terrier", species: "dog" },
  { name: "Bulldog", species: "dog", aliases: ["english bulldog"] },
  { name: "Bullmastiff", species: "dog" },
  { name: "Cairn Terrier", species: "dog" },
  { name: "Canaan Dog", species: "dog" },
  { name: "Cane Corso", species: "dog" },
  { name: "Cardigan Welsh Corgi", species: "dog" },
  { name: "Catahoula Leopard Dog", species: "dog" },
  { name: "Caucasian Shepherd Dog", species: "dog" },
  { name: "Cavalier King Charles Spaniel", species: "dog", aliases: ["cav", "ckcs"] },
  { name: "Cavapoo", species: "dog" },
  { name: "Cesky Terrier", species: "dog" },
  { name: "Chesapeake Bay Retriever", species: "dog" },
  { name: "Chihuahua", species: "dog" },
  { name: "Chinese Crested", species: "dog" },
  { name: "Chinese Shar-Pei", species: "dog", aliases: ["shar pei", "sharpei"] },
  { name: "Chinook", species: "dog" },
  { name: "Chow Chow", species: "dog" },
  { name: "Clumber Spaniel", species: "dog" },
  { name: "Cocker Spaniel", species: "dog" },
  { name: "Cockapoo", species: "dog" },
  { name: "Collie", species: "dog" },
  { name: "Coton de Tulear", species: "dog" },
  { name: "Curly-Coated Retriever", species: "dog" },
  { name: "Dachshund", species: "dog", aliases: ["weiner dog", "wiener dog", "doxie"] },
  { name: "Dalmatian", species: "dog" },
  { name: "Doberman Pinscher", species: "dog", aliases: ["dobie"] },
  { name: "Dogo Argentino", species: "dog" },
  { name: "Dogue de Bordeaux", species: "dog" },
  { name: "Dutch Shepherd", species: "dog" },
  { name: "English Cocker Spaniel", species: "dog" },
  { name: "English Foxhound", species: "dog" },
  { name: "English Mastiff", species: "dog" },
  { name: "English Setter", species: "dog" },
  { name: "English Springer Spaniel", species: "dog" },
  { name: "English Toy Spaniel", species: "dog" },
  { name: "Field Spaniel", species: "dog" },
  { name: "Finnish Lapphund", species: "dog" },
  { name: "Finnish Spitz", species: "dog" },
  { name: "Flat-Coated Retriever", species: "dog" },
  { name: "French Bulldog", species: "dog", aliases: ["frenchie"] },
  { name: "German Pinscher", species: "dog" },
  { name: "German Shepherd", species: "dog", aliases: ["gsd", "alsatian"] },
  { name: "German Shorthaired Pointer", species: "dog", aliases: ["gsp"] },
  { name: "German Wirehaired Pointer", species: "dog" },
  { name: "Giant Schnauzer", species: "dog" },
  { name: "Glen of Imaal Terrier", species: "dog" },
  { name: "Golden Retriever", species: "dog", aliases: ["goldie"] },
  { name: "Goldendoodle", species: "dog" },
  { name: "Gordon Setter", species: "dog" },
  { name: "Great Dane", species: "dog" },
  { name: "Great Pyrenees", species: "dog", aliases: ["pyr"] },
  { name: "Greater Swiss Mountain Dog", species: "dog", aliases: ["swissy"] },
  { name: "Greyhound", species: "dog" },
  { name: "Havanese", species: "dog" },
  { name: "Ibizan Hound", species: "dog" },
  { name: "Icelandic Sheepdog", species: "dog" },
  { name: "Irish Setter", species: "dog" },
  { name: "Irish Terrier", species: "dog" },
  { name: "Irish Water Spaniel", species: "dog" },
  { name: "Irish Wolfhound", species: "dog" },
  { name: "Italian Greyhound", species: "dog", aliases: ["iggy"] },
  { name: "Jack Russell Terrier", species: "dog" },
  { name: "Japanese Chin", species: "dog" },
  { name: "Japanese Spitz", species: "dog" },
  { name: "Keeshond", species: "dog" },
  { name: "Kerry Blue Terrier", species: "dog" },
  { name: "Komondor", species: "dog" },
  { name: "Kuvasz", species: "dog" },
  { name: "Labradoodle", species: "dog" },
  { name: "Labrador Retriever", species: "dog", aliases: ["lab"] },
  { name: "Lagotto Romagnolo", species: "dog" },
  { name: "Lakeland Terrier", species: "dog" },
  { name: "Leonberger", species: "dog" },
  { name: "Lhasa Apso", species: "dog" },
  { name: "Lowchen", species: "dog" },
  { name: "Maltese", species: "dog" },
  { name: "Maltipoo", species: "dog" },
  { name: "Manchester Terrier", species: "dog" },
  { name: "Mastiff", species: "dog" },
  { name: "Miniature American Shepherd", species: "dog" },
  { name: "Miniature Bull Terrier", species: "dog" },
  { name: "Miniature Pinscher", species: "dog", aliases: ["min pin"] },
  { name: "Miniature Schnauzer", species: "dog" },
  { name: "Morkie", species: "dog" },
  { name: "Neapolitan Mastiff", species: "dog" },
  { name: "Newfoundland", species: "dog", aliases: ["newfie"] },
  { name: "Norfolk Terrier", species: "dog" },
  { name: "Norwegian Buhund", species: "dog" },
  { name: "Norwegian Elkhound", species: "dog" },
  { name: "Norwich Terrier", species: "dog" },
  { name: "Nova Scotia Duck Tolling Retriever", species: "dog", aliases: ["toller"] },
  { name: "Old English Sheepdog", species: "dog" },
  { name: "Otterhound", species: "dog" },
  { name: "Papillon", species: "dog" },
  { name: "Pekingese", species: "dog" },
  { name: "Pembroke Welsh Corgi", species: "dog", aliases: ["corgi"] },
  { name: "Petit Basset Griffon Vendeen", species: "dog", aliases: ["pbgv"] },
  { name: "Pharaoh Hound", species: "dog" },
  { name: "Plott Hound", species: "dog" },
  { name: "Pointer", species: "dog" },
  { name: "Polish Lowland Sheepdog", species: "dog" },
  { name: "Pomeranian", species: "dog", aliases: ["pom"] },
  { name: "Pomsky", species: "dog" },
  { name: "Poodle (Miniature)", species: "dog" },
  { name: "Poodle (Standard)", species: "dog" },
  { name: "Poodle (Toy)", species: "dog" },
  { name: "Portuguese Water Dog", species: "dog" },
  { name: "Pug", species: "dog" },
  { name: "Puli", species: "dog" },
  { name: "Pumi", species: "dog" },
  { name: "Rat Terrier", species: "dog" },
  { name: "Redbone Coonhound", species: "dog" },
  { name: "Rhodesian Ridgeback", species: "dog" },
  { name: "Rottweiler", species: "dog", aliases: ["rottie"] },
  { name: "Russell Terrier", species: "dog" },
  { name: "Saint Bernard", species: "dog" },
  { name: "Saluki", species: "dog" },
  { name: "Samoyed", species: "dog", aliases: ["sammy"] },
  { name: "Schipperke", species: "dog" },
  { name: "Scottish Deerhound", species: "dog" },
  { name: "Scottish Terrier", species: "dog", aliases: ["scottie"] },
  { name: "Sealyham Terrier", species: "dog" },
  { name: "Shetland Sheepdog", species: "dog", aliases: ["sheltie"] },
  { name: "Shiba Inu", species: "dog" },
  { name: "Shih Tzu", species: "dog" },
  { name: "Shih-Poo", species: "dog" },
  { name: "Siberian Husky", species: "dog", aliases: ["husky"] },
  { name: "Silky Terrier", species: "dog" },
  { name: "Skye Terrier", species: "dog" },
  { name: "Sloughi", species: "dog" },
  { name: "Soft Coated Wheaten Terrier", species: "dog", aliases: ["wheaten"] },
  { name: "Spanish Water Dog", species: "dog" },
  { name: "Spinone Italiano", species: "dog" },
  { name: "Staffordshire Bull Terrier", species: "dog", aliases: ["staffie"] },
  { name: "Standard Schnauzer", species: "dog" },
  { name: "Sussex Spaniel", species: "dog" },
  { name: "Swedish Vallhund", species: "dog" },
  { name: "Tibetan Mastiff", species: "dog" },
  { name: "Tibetan Spaniel", species: "dog" },
  { name: "Tibetan Terrier", species: "dog" },
  { name: "Toy Fox Terrier", species: "dog" },
  { name: "Treeing Walker Coonhound", species: "dog" },
  { name: "Vizsla", species: "dog" },
  { name: "Weimaraner", species: "dog" },
  { name: "Welsh Springer Spaniel", species: "dog" },
  { name: "Welsh Terrier", species: "dog" },
  { name: "West Highland White Terrier", species: "dog", aliases: ["westie"] },
  { name: "Whippet", species: "dog" },
  { name: "Wire Fox Terrier", species: "dog" },
  { name: "Wirehaired Pointing Griffon", species: "dog" },
  { name: "Xoloitzcuintli", species: "dog", aliases: ["xolo"] },
  { name: "Yorkipoo", species: "dog" },
  { name: "Yorkshire Terrier", species: "dog", aliases: ["yorkie"] },

  // Cats — top picks
  { name: "Mixed breed", species: "cat", aliases: ["domestic", "moggy"] },
  { name: "Unknown", species: "cat" },
  { name: "Domestic Shorthair", species: "cat", aliases: ["dsh"] },
  { name: "Domestic Longhair", species: "cat", aliases: ["dlh"] },
  { name: "Domestic Mediumhair", species: "cat", aliases: ["dmh"] },
  { name: "Abyssinian", species: "cat" },
  { name: "American Bobtail", species: "cat" },
  { name: "American Curl", species: "cat" },
  { name: "American Shorthair", species: "cat" },
  { name: "American Wirehair", species: "cat" },
  { name: "Balinese", species: "cat" },
  { name: "Bengal", species: "cat" },
  { name: "Birman", species: "cat" },
  { name: "Bombay", species: "cat" },
  { name: "British Longhair", species: "cat" },
  { name: "British Shorthair", species: "cat" },
  { name: "Burmese", species: "cat" },
  { name: "Burmilla", species: "cat" },
  { name: "Chartreux", species: "cat" },
  { name: "Cornish Rex", species: "cat" },
  { name: "Devon Rex", species: "cat" },
  { name: "Egyptian Mau", species: "cat" },
  { name: "European Shorthair", species: "cat" },
  { name: "Exotic Shorthair", species: "cat" },
  { name: "Havana Brown", species: "cat" },
  { name: "Himalayan", species: "cat" },
  { name: "Japanese Bobtail", species: "cat" },
  { name: "Korat", species: "cat" },
  { name: "LaPerm", species: "cat" },
  { name: "Maine Coon", species: "cat" },
  { name: "Manx", species: "cat" },
  { name: "Munchkin", species: "cat" },
  { name: "Nebelung", species: "cat" },
  { name: "Norwegian Forest Cat", species: "cat" },
  { name: "Ocicat", species: "cat" },
  { name: "Oriental", species: "cat" },
  { name: "Persian", species: "cat" },
  { name: "Pixiebob", species: "cat" },
  { name: "Ragamuffin", species: "cat" },
  { name: "Ragdoll", species: "cat" },
  { name: "Russian Blue", species: "cat" },
  { name: "Savannah", species: "cat" },
  { name: "Scottish Fold", species: "cat" },
  { name: "Selkirk Rex", species: "cat" },
  { name: "Siamese", species: "cat" },
  { name: "Siberian", species: "cat" },
  { name: "Singapura", species: "cat" },
  { name: "Snowshoe", species: "cat" },
  { name: "Somali", species: "cat" },
  { name: "Sphynx", species: "cat" },
  { name: "Tonkinese", species: "cat" },
  { name: "Toyger", species: "cat" },
  { name: "Turkish Angora", species: "cat" },
  { name: "Turkish Van", species: "cat" },
];

/**
 * Filter the catalog by typed query + species. Free-text matches:
 * - case-insensitive substring of name OR any alias
 * - empty query returns the first ~20 entries for the species
 */
export function filterBreeds(
  query: string,
  species: "dog" | "cat" | "other" | null,
  limit = 40,
): BreedEntry[] {
  const q = query.trim().toLowerCase();
  const speciesFilter = species === "other" ? null : species;
  const inSpecies = (b: BreedEntry) =>
    !speciesFilter || b.species === speciesFilter;

  if (!q) {
    return BREEDS.filter(inSpecies).slice(0, limit);
  }

  const matches: { entry: BreedEntry; rank: number }[] = [];
  for (const b of BREEDS) {
    if (!inSpecies(b)) continue;
    const name = b.name.toLowerCase();
    const aliases = b.aliases ?? [];

    let rank: number | null = null;
    if (name.startsWith(q)) rank = 0;
    else if (aliases.some((a) => a.toLowerCase().startsWith(q))) rank = 1;
    else if (name.includes(q)) rank = 2;
    else if (aliases.some((a) => a.toLowerCase().includes(q))) rank = 3;

    if (rank !== null) matches.push({ entry: b, rank });
  }
  matches.sort((a, b) => a.rank - b.rank);
  return matches.slice(0, limit).map((m) => m.entry);
}
