module.exports = {
    preset: "ts-jest",
    testEnvironment: "jsdom",
    testMatch: ["<rootDir>/src/**/__tests__/**/*.test.ts?(x)"],
    moduleNameMapper: {
        "^@components/(.*)$": "<rootDir>/src/components/$1",
        "^@utils/(.*)$": "<rootDir>/src/utils/$1",
        "^@store/(.*)$": "<rootDir>/src/store/$1",
        "^@repository/(.*)$": "<rootDir>/src/repository/$1",
        "^@pages/(.*)$": "<rootDir>/src/pages/$1",
        "^@/(.*)$": "<rootDir>/src/$1",
    },
    setupFilesAfterEnv: ["<rootDir>/tests/setupTests.ts"],
    globals: {
        "ts-jest": {
            tsconfig: "<rootDir>/tsconfig.jest.json",
            diagnostics: false,
        },
    },
};
