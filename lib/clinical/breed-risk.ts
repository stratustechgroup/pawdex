/**
 * Breed-and-age-appropriate screening recommendations distilled from AAHA
 * Canine Life Stage Guidelines, AAHA/AAFP Feline Life Stage Guidelines, and
 * breed-specific commentary in those references. Hand-curated v1 — the list
 * is conservative + cites a source per entry. Pawdex never replaces a vet's
 * clinical judgment; the UI always frames these as "discuss at next visit."
 *
 * To extend: add an entry to the appropriate breed key in BREED_RISK_TABLE.
 * Use breed key in lowercase; matching is case-insensitive substring.
 */

export type ScreeningWindow = {
  condition: string;
  starts_age_years: number;
  cadence: string; // "annual" / "every 2 years" / "once between 6-8" — descriptive
  rationale: string;
  source: string;
};

type BreedRiskEntry = {
  breed_key: string; // lowercased substring to match against pet.breed
  species: "dog" | "cat";
  screenings: ScreeningWindow[];
};

// Reference content. Sources cited inline. Conservative scope — only entries
// where the screening recommendation is well-established in AAHA / AAFP /
// peer-reviewed breed-club guidance.
export const BREED_RISK_TABLE: BreedRiskEntry[] = [
  // Dogs — large breeds with established hereditary risks.
  {
    breed_key: "golden retriever",
    species: "dog",
    screenings: [
      {
        condition: "Hemangiosarcoma screening (abdominal ultrasound)",
        starts_age_years: 7,
        cadence: "annual",
        rationale:
          "Goldens have one of the highest lifetime hemangiosarcoma incidences of any breed. Early ultrasound at age 7+ improves detection.",
        source: "Morris Animal Foundation Golden Retriever Lifetime Study, 2024 interim report",
      },
      {
        condition: "Hip + elbow x-ray (OFA / PennHIP)",
        starts_age_years: 2,
        cadence: "once, then re-evaluate if symptomatic",
        rationale: "Hip and elbow dysplasia incidence ~20% in the breed.",
        source: "OFA breed statistics; AAHA Canine Life Stage Guidelines",
      },
    ],
  },
  {
    breed_key: "labrador",
    species: "dog",
    screenings: [
      {
        condition: "Hip + elbow x-ray (OFA / PennHIP)",
        starts_age_years: 2,
        cadence: "once, then re-evaluate if symptomatic",
        rationale: "Top 5 breed for hip dysplasia by prevalence.",
        source: "OFA breed statistics",
      },
      {
        condition: "Eye exam (PRA, cataracts)",
        starts_age_years: 1,
        cadence: "every 2 years",
        rationale: "Progressive retinal atrophy (prcd-PRA) is a known concern.",
        source: "AAHA Canine Life Stage Guidelines; AKC breed health survey",
      },
    ],
  },
  {
    breed_key: "doberman",
    species: "dog",
    screenings: [
      {
        condition: "Echocardiogram + Holter (DCM screening)",
        starts_age_years: 3,
        cadence: "annual",
        rationale:
          "Dilated cardiomyopathy is the leading cause of mortality in the breed. Annual screening from age 3 is the published recommendation.",
        source: "DCM Working Group / European Society of Veterinary Cardiology 2024 consensus",
      },
      {
        condition: "Von Willebrand factor assay (vWD type I)",
        starts_age_years: 1,
        cadence: "once",
        rationale:
          "vWD type I carrier rate in Dobermans is high; baseline factor activity guides surgical planning.",
        source: "AKC Canine Health Foundation breeder recommendations",
      },
    ],
  },
  {
    breed_key: "german shepherd",
    species: "dog",
    screenings: [
      {
        condition: "Hip + elbow x-ray (OFA / PennHIP)",
        starts_age_years: 2,
        cadence: "once",
        rationale: "Top 3 breed for hip dysplasia.",
        source: "OFA breed statistics",
      },
      {
        condition: "Degenerative myelopathy DNA test (SOD1)",
        starts_age_years: 1,
        cadence: "once",
        rationale:
          "DM carrier rate elevated in the breed; testing informs monitoring rather than prevention.",
        source: "AKC Canine Health Foundation",
      },
    ],
  },
  {
    breed_key: "bulldog",
    species: "dog",
    screenings: [
      {
        condition: "BOAS (brachycephalic obstructive airway) evaluation",
        starts_age_years: 1,
        cadence: "annual",
        rationale:
          "Brachycephalic syndrome affects most English Bulldogs. Early functional grading guides surgical intervention.",
        source: "Royal Veterinary College BOAS Research Group",
      },
      {
        condition: "Dental + dermatologic exam",
        starts_age_years: 2,
        cadence: "annual",
        rationale: "Skinfold dermatitis and dental crowding are breed-defining.",
        source: "AAHA Canine Life Stage Guidelines",
      },
    ],
  },
  {
    breed_key: "boxer",
    species: "dog",
    screenings: [
      {
        condition: "Echocardiogram + Holter (ARVC screening)",
        starts_age_years: 4,
        cadence: "annual",
        rationale:
          "Boxer cardiomyopathy (ARVC) is a documented breed predisposition.",
        source: "American College of Veterinary Internal Medicine consensus 2024",
      },
      {
        condition: "Routine palpation + lymph node check (lymphoma vigilance)",
        starts_age_years: 6,
        cadence: "every 6 months",
        rationale:
          "Boxers have elevated lifetime incidence of multicentric lymphoma.",
        source: "Veterinary Cancer Society breed-risk index",
      },
    ],
  },
  {
    breed_key: "dachshund",
    species: "dog",
    screenings: [
      {
        condition: "Spinal palpation + back-pain screening (IVDD)",
        starts_age_years: 3,
        cadence: "annual",
        rationale:
          "Intervertebral disc disease is the dominant orthopedic concern in the breed.",
        source: "AKC Canine Health Foundation",
      },
    ],
  },
  // Cats — established AAFP breed-risk patterns.
  {
    breed_key: "maine coon",
    species: "cat",
    screenings: [
      {
        condition: "Echocardiogram (HCM screening)",
        starts_age_years: 1,
        cadence: "every 2 years until age 7, then annual",
        rationale:
          "Hypertrophic cardiomyopathy MYBPC3 mutation common in the breed.",
        source: "American College of Veterinary Internal Medicine HCM statement 2020",
      },
    ],
  },
  {
    breed_key: "ragdoll",
    species: "cat",
    screenings: [
      {
        condition: "Echocardiogram (HCM screening)",
        starts_age_years: 1,
        cadence: "every 2 years until age 7, then annual",
        rationale: "Ragdoll-specific HCM mutation (R820W) documented.",
        source: "ACVIM HCM statement 2020",
      },
    ],
  },
  {
    breed_key: "persian",
    species: "cat",
    screenings: [
      {
        condition: "Renal ultrasound (PKD screening)",
        starts_age_years: 1,
        cadence: "once, then if symptomatic",
        rationale:
          "Polycystic kidney disease autosomal dominant in ~37% of historic Persian lines.",
        source: "AAFP Feline Life Stage Guidelines",
      },
    ],
  },
  {
    breed_key: "siamese",
    species: "cat",
    screenings: [
      {
        condition: "Dental + oral exam",
        starts_age_years: 2,
        cadence: "annual",
        rationale:
          "Elevated incidence of feline orofacial pain syndrome and dental disease.",
        source: "AAFP/AVDC oral health consensus",
      },
    ],
  },
];

// Universal life-stage screenings — apply to every pet regardless of breed.
export const UNIVERSAL_SCREENINGS_DOG: ScreeningWindow[] = [
  {
    condition: "Annual physical exam + dental check",
    starts_age_years: 1,
    cadence: "annual (semi-annual after age 7)",
    rationale: "Baseline catch-everything visit.",
    source: "AAHA Canine Life Stage Guidelines",
  },
  {
    condition: "Senior wellness bloodwork (CBC, chem, T4, UA)",
    starts_age_years: 7,
    cadence: "annual",
    rationale:
      "Early renal, hepatic, and thyroid disease detection materially improves outcomes.",
    source: "AAHA Senior Care Guidelines",
  },
];

export const UNIVERSAL_SCREENINGS_CAT: ScreeningWindow[] = [
  {
    condition: "Annual physical exam + dental check",
    starts_age_years: 1,
    cadence: "annual (semi-annual after age 10)",
    rationale: "Cats hide illness — regular visits catch subtle change.",
    source: "AAFP Feline Life Stage Guidelines",
  },
  {
    condition: "Senior wellness bloodwork (CBC, chem, T4, UA)",
    starts_age_years: 10,
    cadence: "annual",
    rationale:
      "Hyperthyroidism, CKD, and diabetes detection windows widen in senior cats.",
    source: "AAFP Senior Care Guidelines",
  },
  {
    condition: "Blood pressure measurement",
    starts_age_years: 10,
    cadence: "annual",
    rationale:
      "Hypertension prevalence > 20% in senior cats; routinely undermeasured.",
    source: "ACVIM Hypertension Consensus 2018",
  },
];

export type BreedRiskReport = {
  matched_entries: BreedRiskEntry[];
  universal: ScreeningWindow[];
  age_years: number | null;
  due_now: ScreeningWindow[];
  upcoming: ScreeningWindow[];
  not_yet: ScreeningWindow[];
};

export function buildBreedRiskReport(input: {
  species: string | null;
  breed: string | null;
  date_of_birth: string | null;
}): BreedRiskReport {
  const speciesNormalized: "dog" | "cat" | null =
    input.species === "dog" || input.species === "cat" ? input.species : null;
  const breedLower = input.breed?.toLowerCase() ?? "";

  const matched_entries = BREED_RISK_TABLE.filter(
    (entry) =>
      (speciesNormalized === null || entry.species === speciesNormalized) &&
      breedLower.includes(entry.breed_key),
  );

  const universal: ScreeningWindow[] =
    speciesNormalized === "dog"
      ? UNIVERSAL_SCREENINGS_DOG
      : speciesNormalized === "cat"
        ? UNIVERSAL_SCREENINGS_CAT
        : [];

  let age_years: number | null = null;
  if (input.date_of_birth) {
    const dob = new Date(input.date_of_birth);
    if (!Number.isNaN(dob.getTime())) {
      age_years = (Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    }
  }

  const allScreenings: ScreeningWindow[] = [
    ...universal,
    ...matched_entries.flatMap((e) => e.screenings),
  ];

  const due_now: ScreeningWindow[] = [];
  const upcoming: ScreeningWindow[] = [];
  const not_yet: ScreeningWindow[] = [];

  if (age_years === null) {
    upcoming.push(...allScreenings);
  } else {
    for (const s of allScreenings) {
      if (age_years >= s.starts_age_years) {
        due_now.push(s);
      } else if (age_years >= s.starts_age_years - 1) {
        upcoming.push(s);
      } else {
        not_yet.push(s);
      }
    }
  }

  return {
    matched_entries,
    universal,
    age_years,
    due_now,
    upcoming,
    not_yet,
  };
}
