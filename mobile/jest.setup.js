// Mock expo-crypto
jest.mock("expo-crypto", () => ({
  digestStringAsync: jest.fn(async (_algo, data) => {
    // Simple mock: return a fake hex hash
    return "mock_sha256_" + Buffer.from(data).toString("hex").slice(0, 16);
  }),
  CryptoDigestAlgorithm: {
    SHA256: "SHA-256",
  },
}));

// Mock expo-secure-store
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

// Mock expo-sqlite
jest.mock("expo-sqlite", () => ({
  openDatabaseSync: jest.fn(() => ({
    execSync: jest.fn(),
    getAllSync: jest.fn(() => []),
    getFirstSync: jest.fn(() => null),
    runSync: jest.fn(() => ({ lastInsertRowId: 1, changes: 1 })),
  })),
}));

// Mock expo-file-system
jest.mock("expo-file-system", () => ({
  documentDirectory: "/mock/documents/",
  readAsStringAsync: jest.fn(async () => ""),
  writeAsStringAsync: jest.fn(async () => {}),
  makeDirectoryAsync: jest.fn(async () => {}),
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  deleteAsync: jest.fn(async () => {}),
  readDirectoryAsync: jest.fn(async () => []),
  EncodingType: { UTF8: "utf8", Base64: "base64" },
}));

// Mock expo-haptics
jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Error: "error", Warning: "warning" },
}));

// Mock expo-constants
jest.mock("expo-constants", () => ({
  default: {
    expoConfig: { name: "bruin-test", slug: "bruin-test" },
  },
}));
