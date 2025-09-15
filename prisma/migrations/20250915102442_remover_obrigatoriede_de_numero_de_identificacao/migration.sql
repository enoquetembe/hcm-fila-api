-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_pacientes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nomeCompleto" TEXT NOT NULL,
    "numeroIdentificacao" TEXT,
    "idade" INTEGER NOT NULL,
    "dataNascimento" DATETIME,
    "telefone" TEXT,
    "endereco" TEXT,
    "responsavel" TEXT,
    "telefoneResponsavel" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_pacientes" ("ativo", "createdAt", "dataNascimento", "endereco", "id", "idade", "nomeCompleto", "numeroIdentificacao", "responsavel", "telefone", "telefoneResponsavel", "updatedAt") SELECT "ativo", "createdAt", "dataNascimento", "endereco", "id", "idade", "nomeCompleto", "numeroIdentificacao", "responsavel", "telefone", "telefoneResponsavel", "updatedAt" FROM "pacientes";
DROP TABLE "pacientes";
ALTER TABLE "new_pacientes" RENAME TO "pacientes";
CREATE UNIQUE INDEX "pacientes_numeroIdentificacao_key" ON "pacientes"("numeroIdentificacao");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
