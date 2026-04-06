const mockFirestore = {
  collection: jest.fn().mockReturnThis(),
  doc: jest.fn().mockReturnThis(),
  set: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue({ exists: false, data: () => null }),
  update: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  onSnapshot: jest.fn().mockReturnValue(jest.fn()),
};
const firestoreModule = jest.fn(() => mockFirestore);
firestoreModule.FieldValue = { serverTimestamp: jest.fn(), arrayUnion: jest.fn(), arrayRemove: jest.fn() };
module.exports = firestoreModule;
module.exports.default = firestoreModule;
