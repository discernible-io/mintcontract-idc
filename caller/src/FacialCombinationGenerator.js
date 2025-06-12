// Improved Facial Combination Generator - Optimized for AI Generation
// Based on extensive testing with Midjourney and other AI image generators

class FacialCombinationGenerator {
  constructor() {
    // Optimized categories based on AI testing feedback
    this.categories = {
      skin_tones: {
        code: 'A',
        values: [
          "pale-skinned", "fair-skinned", "medium-skinned", "tan-skinned",
          "olive-skinned", "bronze-skinned", "dark-skinned", "ebony-skinned",
          "golden-skinned", "ivory-skinned", "peach-toned-skin", "rosy-skinned",
          "ruddy-skinned", "sallow-skinned", "ashen-skinned", "porcelain-skinned",
          "warm-toned-skin", "cool-toned-skin", "red-toned-skin"
          // REMOVED: yellow-toned-skin, pink-toned-skin (causes clothing confusion)
          // REMOVED: blue-toned-skin, green-toned-skin (unrealistic)
        ]
      },

      regional_bone_structure: {
        code: 'B',
        values: [
          "Nordic", "Mediterranean", "Slavic", "East-Asian", "Southeast-Asian",
          "South-Asian", "West-African", "East-African", "Native-American",
          "Polynesian", "Celtic-features", "Turkish"
          // CHANGED: Middle-Eastern → Turkish (avoids head covering bias)
        ]
      },
      
      face_shape: {
        code: 'C',
        values: [
          "oval-faced", "round-faced", "square-faced", "rectangular-faced",
          "heart-shaped-face", "diamond-shaped-face", "triangular-faced", "pear-shaped-face",
          "narrow-faced", "wide-faced", "angular-faced", "curved-faced",
          "asymmetrical-faced", "elongated-faced", "compact-faced"
        ]
      },
      
      age_related: {
        code: 'D',
        values: [
          "teenage-person", "young-adult-25", "middle-aged-50", "senior-65", "elderly-person"
          // IMPROVED: More specific, AI-friendly age terms
        ]
      },
      
      eyes: {
        code: 'E',
        values: [
          "small-eyes", "large-eyes", "deep-set-eyes", "prominent-eyes",
          "close-set-eyes", "wide-set-eyes", "almond-shaped-eyes", 
          "upturned-eyes", "downturned-eyes", "monolid-eyes"
          // REMOVED: hooded-eyes (causes hood clothing confusion)
        ]
      },
      
      eyebrow_style: {
        code: 'F',
        values: [
          "thick-eyebrows", "thin-eyebrows", "arched-eyebrows", 
          "straight-eyebrows", "bushy-eyebrows", "sparse-eyebrows"
          // REMOVED: unibrow (consistently ignored by AI)
          // IMPROVED: Added -eyebrows suffix for disambiguation
        ]
      },
      
      overall_structure: {
        code: 'G',
        values: ["masculine", "feminine"]
        // REMOVED: androgynous (high variance, unclear results)
      },
      
      nose: {
        code: 'H',
        values: [
          "aquiline-nose", "button-nose", "Roman-nose", 
          "snub-nose", "flared-nose", "pinched-nose"
        ]
      },
      
      lips: {
        code: 'I',
        values: [
          "thin-lips", "full-lips", "pouty-lips", 
          "defined-lips", "bow-shaped-lips"
        ]
      },
      
      skin_conditions: {
        code: 'J',
        values: ["freckled", "spotted", "scarred", "lined", "wrinkled", "clear"]
      },
      
      hair_color: {
        code: 'K',
        values: [
          "black-hair", "dark-brown-hair", "brown-hair", "light-brown-hair",
          "blonde-hair", "platinum-blonde-hair", "red-hair", "auburn-hair",
          "gray-hair", "white-hair", "silver-hair"
        ]
      }
    };

    // Spanish NIF checksum letters
    this.nifLetters = 'TRWAGMYFPDXBNJZSQVHLCKE';

    // Create encoding/decoding maps
    this.createEncodingMaps();
  }

  createEncodingMaps() {
    const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz-_';
    
    this.encodeMap = {};
    this.decodeMap = {};

    Object.entries(this.categories).forEach(([categoryName, categoryData]) => {
      this.encodeMap[categoryName] = {};
      this.decodeMap[categoryData.code] = {
        name: categoryName,
        values: {}
      };
      
      categoryData.values.forEach((value, index) => {
        const valueCode = base64Chars[index];
        this.encodeMap[categoryName][value] = valueCode;
        this.decodeMap[categoryData.code].values[valueCode] = value;
      });
    });
  }

  // Calculate Spanish NIF checksum
  calculateNIFChecksum(numberString) {
    const number = parseInt(numberString, 10);
    const remainder = number % 23;
    return this.nifLetters[remainder];
  }

  // Convert encoded string to number for checksum calculation
  encodeStringToNumber(encodedString) {
    let number = '';
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz-_';
    
    for (let char of encodedString) {
      const position = charset.indexOf(char);
      number += position.toString().padStart(2, '0');
    }
    
    return number;
  }

  // Generate a random combination
  generateRandom() {
    const combination = {};
    const categoryNames = Object.keys(this.categories);
    
    categoryNames.forEach(categoryName => {
      const values = this.categories[categoryName].values;
      const randomIndex = Math.floor(Math.random() * values.length);
      combination[categoryName] = values[randomIndex];
    });
    
    return combination;
  }

  // Encode combination to string with NIF checksum
  encode(combination) {
    let encoded = '';
    const categoryNames = Object.keys(this.categories);
    
    categoryNames.forEach(categoryName => {
      const categoryCode = this.categories[categoryName].code;
      const value = combination[categoryName];
      const valueCode = this.encodeMap[categoryName][value];
      encoded += categoryCode + valueCode;
    });
    
    // Calculate checksum
    const numberForChecksum = this.encodeStringToNumber(encoded);
    const checksumLetter = this.calculateNIFChecksum(numberForChecksum);
    
    return encoded + checksumLetter;
  }

  // Decode string with checksum validation
  decode(encodedStringWithChecksum) {
    const encodedString = encodedStringWithChecksum.slice(0, -1);
    const providedChecksum = encodedStringWithChecksum.slice(-1);
    
    // Validate checksum
    const calculatedNumber = this.encodeStringToNumber(encodedString);
    const expectedChecksum = this.calculateNIFChecksum(calculatedNumber);
    
    if (providedChecksum !== expectedChecksum) {
      throw new Error(`Invalid checksum. Expected: ${expectedChecksum}, Got: ${providedChecksum}`);
    }
    
    const combination = {};
    
    // Process pairs of characters
    for (let i = 0; i < encodedString.length; i += 2) {
      const categoryCode = encodedString[i];
      const valueCode = encodedString[i + 1];
      
      if (this.decodeMap[categoryCode]) {
        const categoryName = this.decodeMap[categoryCode].name;
        const value = this.decodeMap[categoryCode].values[valueCode];
        combination[categoryName] = value;
      }
    }
    
    return combination;
  }

  // Validate an encoded string
  validate(encodedStringWithChecksum) {
    try {
      this.decode(encodedStringWithChecksum);
      return { valid: true, error: null };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  // Generate optimized prompt for AI image generation
  generatePrompt(combination, expression = 'happy', view = 'front-view') {
    // OPTIMIZED ORDER: Age + Gender first for better AI interpretation
    const orderedPrompt = [
      combination.age_related,
      combination.overall_structure,
      combination.skin_tones,
      combination.regional_bone_structure,
      combination.face_shape,
      combination.eyes,
      combination.eyebrow_style,
      combination.nose,
      combination.lips,
      combination.skin_conditions,
      combination.hair_color,
      expression,
      view
    ];
    
    return orderedPrompt.join(' ');
  }

  // Generate neutral mask prompt (original format)
  generateNeutralPrompt(combination) {
    const values = Object.values(combination);
    return values.join(' ') + ' neutral mask front view';
  }

  // Generate everything at once with optimized prompt
  generateRandomCombination(expression = 'happy', view = 'front-view') {
    const combination = this.generateRandom();
    const encoded = this.encode(combination);
    const prompt = this.generatePrompt(combination, expression, view);
    const neutralPrompt = this.generateNeutralPrompt(combination);
    
    const mainEncoded = encoded.slice(0, -1);
    const checksum = encoded.slice(-1);
    
    return {
      combination,
      encoded,
      mainEncoded,
      checksum,
      prompt,
      neutralPrompt,
      stats: {
        encodedLength: encoded.length,
        mainEncodedLength: mainEncoded.length,
        promptLength: prompt.length,
        totalCategories: Object.keys(combination).length,
        totalFeatures: this.getTotalFeatures()
      }
    };
  }

  // Generate multiple combinations with full coverage
  generateCoverageSet(expression = 'happy', view = 'front-view') {
    const combinations = [];
    const maxValues = Math.max(...Object.values(this.categories).map(cat => cat.values.length));
    
    for (let i = 0; i < maxValues; i++) {
      const combination = {};
      const categoryNames = Object.keys(this.categories);
      
      categoryNames.forEach(categoryName => {
        const values = this.categories[categoryName].values;
        const index = i % values.length;
        combination[categoryName] = values[index];
      });
      
      const encoded = this.encode(combination);
      const prompt = this.generatePrompt(combination, expression, view);
      
      combinations.push({
        combination,
        encoded,
        prompt
      });
    }
    
    return combinations;
  }

  // Get statistics about the generator
  getStats() {
    const totalCombinations = Object.values(this.categories)
      .reduce((product, category) => product * category.values.length, 1);
    
    const totalFeatures = this.getTotalFeatures();
    const maxCategorySize = Math.max(...Object.values(this.categories).map(cat => cat.values.length));
    
    return {
      totalCategories: Object.keys(this.categories).length,
      totalFeatures: totalFeatures,
      totalCombinations: totalCombinations.toLocaleString(),
      encodedStringLength: (Object.keys(this.categories).length * 2) + 1,
      maxCategorySize: maxCategorySize,
      minCombinationsForFullCoverage: maxCategorySize,
      optimizations: {
        removedUnrealisticSkinTones: ['yellow-toned-skin', 'pink-toned-skin', 'blue-toned-skin', 'green-toned-skin'],
        removedClothingConfusion: ['hooded-eyes'],
        removedIgnoredTerms: ['unibrow'],
        removedHighVariance: ['androgynous'],
        improvedAgeTerms: true,
        improvedPromptOrder: 'age-gender-first',
        avoidedCulturalBias: 'replaced-middle-eastern-with-turkish'
      }
    };
  }

  // Get total number of features
  getTotalFeatures() {
    return Object.values(this.categories)
      .reduce((sum, category) => sum + category.values.length, 0);
  }

  // Show encoding mapping for reference
  showEncodingMap() {
    console.log('=== OPTIMIZED ENCODING MAP ===');
    Object.entries(this.categories).forEach(([categoryName, categoryData]) => {
      console.log(`\n${categoryName.toUpperCase()} (${categoryData.code}):`);
      categoryData.values.forEach((value, index) => {
        const code = this.encodeMap[categoryName][value];
        console.log(`  ${categoryData.code}${code}: ${value}`);
      });
    });
  }
}

// Usage Examples
const generator = new FacialCombinationGenerator();

// Generate optimized prompt
console.log('=== OPTIMIZED RANDOM COMBINATION ===');
const result = generator.generateRandomCombination();
console.log('Encoded:', result.encoded);
console.log('Optimized prompt:', result.prompt);
console.log('Neutral prompt:', result.neutralPrompt);
console.log('Stats:', result.stats);

// Generate full coverage set
console.log('\n=== COVERAGE SET GENERATION ===');
const coverageSet = generator.generateCoverageSet();
console.log(`Generated ${coverageSet.length} combinations for full feature coverage`);

// Show improvements
console.log('\n=== OPTIMIZATION STATS ===');
console.log(generator.getStats());

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FacialCombinationGenerator;
}