-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ADMIN',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "pacientes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nomeCompleto" TEXT NOT NULL,
    "numeroIdentificacao" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "senhas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codigo" TEXT NOT NULL,
    "prioridade" TEXT NOT NULL,
    "sintomas" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AGUARDANDO',
    "posicaoFila" INTEGER,
    "tempoEspera" INTEGER,
    "emitidaEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "iniciadaEm" DATETIME,
    "finalizadaEm" DATETIME,
    "pacienteId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    CONSTRAINT "senhas_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "senhas_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "atendimentos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "diagnostico" TEXT,
    "prescricao" TEXT,
    "observacoes" TEXT,
    "duracaoMinutos" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'EM_ANDAMENTO',
    "iniciadoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizadoEm" DATETIME,
    "pacienteId" TEXT NOT NULL,
    "senhaId" TEXT NOT NULL,
    CONSTRAINT "atendimentos_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "atendimentos_senhaId_fkey" FOREIGN KEY ("senhaId") REFERENCES "senhas" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "historico_medico" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "descricao" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "data" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pacienteId" TEXT NOT NULL,
    CONSTRAINT "historico_medico_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "relatorios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tipo" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "periodo" TEXT NOT NULL,
    "dadosJson" TEXT NOT NULL,
    "geradoEm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataInicio" DATETIME,
    "dataFim" DATETIME,
    "prioridades" TEXT,
    "turnos" TEXT,
    "faixasEtarias" TEXT,
    "usuarioId" TEXT NOT NULL,
    CONSTRAINT "relatorios_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "configuracoes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'string',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "logs_sistema" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "detalhes" TEXT,
    "usuarioId" TEXT,
    "ipAddress" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "pacientes_numeroIdentificacao_key" ON "pacientes"("numeroIdentificacao");

-- CreateIndex
CREATE UNIQUE INDEX "senhas_codigo_key" ON "senhas"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "atendimentos_senhaId_key" ON "atendimentos"("senhaId");

-- CreateIndex
CREATE UNIQUE INDEX "configuracoes_chave_key" ON "configuracoes"("chave");
