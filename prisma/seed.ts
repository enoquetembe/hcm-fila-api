// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🌱 Iniciando seed da base de dados...');
    
    // Testar conexão primeiro
    await prisma.$connect();
    console.log('✅ Conectado ao banco de dados');
    
    // Verificar se já existem dados
    const userCount = await prisma.usuario.count();
    const patientCount = await prisma.paciente.count();
    
    console.log(`📊 Dados existentes - Usuários: ${userCount}, Pacientes: ${patientCount}`);
    
    if (userCount > 0) {
      console.log('⚠️  Já existem dados na base. Deseja continuar e limpar tudo? (s/N)');
      
      // Para execução automática, vamos limpar sempre
      console.log('🧹 Limpando dados existentes...');
      await prisma.logSistema.deleteMany();
      await prisma.configuracao.deleteMany();
      await prisma.historicoMedico.deleteMany();
      await prisma.atendimento.deleteMany();
      await prisma.senha.deleteMany();
      await prisma.paciente.deleteMany();
      await prisma.usuario.deleteMany();
      
      console.log('✅ Dados antigos removidos');
    }

    // Criar usuários do sistema
    console.log('👥 Criando usuários...');
    const adminPassword = await bcrypt.hash('admin123', 10);
    const medicoPassword = await bcrypt.hash('medico123', 10);
    const enfermeiroPassword = await bcrypt.hash('enfermeiro123', 10);

    const admin = await prisma.usuario.create({
      data: {
        nome: 'Dr. Admin',
        email: 'admin@hcm.mz',
        senha: adminPassword,
        role: 'ADMIN'
      }
    });
    console.log(`✅ Admin criado: ${admin.id}`);

    const medico = await prisma.usuario.create({
      data: {
        nome: 'Dr. João Silva',
        email: 'joao.silva@hcm.mz',
        senha: medicoPassword,
        role: 'MEDICO'
      }
    });
    console.log(`✅ Médico criado: ${medico.id}`);

    const enfermeiro = await prisma.usuario.create({
      data: {
        nome: 'Enfª Maria Santos',
        email: 'maria.santos@hcm.mz',
        senha: enfermeiroPassword,
        role: 'ENFERMEIRO'
      }
    });
    console.log(`✅ Enfermeiro criado: ${enfermeiro.id}`);

    // Criar pacientes
    console.log('👶 Criando pacientes...');
    const pacientes = [
      {
        nomeCompleto: 'João Pedro Costa',
        numeroIdentificacao: '123456789',
        idade: 8,
        dataNascimento: new Date('2016-03-15'),
        telefone: '+258 84 1234567',
        responsavel: 'Ana Costa',
        telefoneResponsavel: '+258 84 1234567'
      },
      {
        nomeCompleto: 'Carlos Miguel Santos',
        numeroIdentificacao: '987654321',
        idade: 12,
        dataNascimento: new Date('2012-07-20'),
        telefone: '+258 84 9876543',
        responsavel: 'Miguel Santos',
        telefoneResponsavel: '+258 84 9876543'
      },
      {
        nomeCompleto: 'Sofia Isabella Rodrigues',
        numeroIdentificacao: '456789123',
        idade: 5,
        dataNascimento: new Date('2019-11-10'),
        telefone: '+258 84 4567891',
        responsavel: 'Isabella Rodrigues',
        telefoneResponsavel: '+258 84 4567891'
      },
      {
        nomeCompleto: 'Lucas Gabriel Fernandes',
        numeroIdentificacao: '789123456',
        idade: 15,
        dataNascimento: new Date('2009-01-05'),
        telefone: '+258 84 7891234',
        responsavel: 'Gabriel Fernandes',
        telefoneResponsavel: '+258 84 7891234'
      },
      {
        nomeCompleto: 'Mariana Vitória Alves',
        numeroIdentificacao: '321654987',
        idade: 3,
        dataNascimento: new Date('2021-09-18'),
        telefone: '+258 84 3216549',
        responsavel: 'Vitória Alves',
        telefoneResponsavel: '+258 84 3216549'
      },
      {
        nomeCompleto: 'Maria Silva Santos',
        numeroIdentificacao: '654321987',
        idade: 6,
        dataNascimento: new Date('2018-05-22'),
        telefone: '+258 84 6543219',
        responsavel: 'Silva Santos',
        telefoneResponsavel: '+258 84 6543219'
      }
    ];

    const pacientesCriados = [];
    for (const [index, pacienteData] of pacientes.entries()) {
      const paciente = await prisma.paciente.create({
        data: pacienteData
      });
      pacientesCriados.push(paciente);
      console.log(`✅ Paciente ${index + 1} criado: ${paciente.id}`);
    }

    // Criar senhas ativas na fila
    console.log('🎫 Criando senhas na fila...');
    const senhas = [
      {
        codigo: 'A001',
        prioridade: 'MUITO_URGENTE',
        sintomas: 'Febre alta há 3 dias, Dificuldade respiratória, Sinais de desidratação',
        status: 'EM_ATENDIMENTO',
        posicaoFila: 1,
        pacienteId: pacientesCriados[0].id,
        usuarioId: enfermeiro.id,
        tempoEspera: 12
      },
      {
        codigo: 'B003',
        prioridade: 'POUCO_URGENTE',
        sintomas: 'Dor abdominal leve, Consulta de rotina',
        status: 'AGUARDANDO',
        posicaoFila: 2,
        pacienteId: pacientesCriados[1].id,
        usuarioId: enfermeiro.id,
        tempoEspera: 34
      },
      {
        codigo: 'B004',
        prioridade: 'POUCO_URGENTE',
        sintomas: 'Dor de cabeça ocasional, Acompanhamento',
        status: 'AGUARDANDO',
        posicaoFila: 3,
        pacienteId: pacientesCriados[2].id,
        usuarioId: enfermeiro.id,
        tempoEspera: 19
      },
      {
        codigo: 'C001',
        prioridade: 'URGENTE',
        sintomas: 'Dificuldade de deglutição, Vômitos',
        status: 'AGUARDANDO',
        posicaoFila: 4,
        pacienteId: pacientesCriados[3].id,
        usuarioId: enfermeiro.id,
        tempoEspera: 14
      },
      {
        codigo: 'C002',
        prioridade: 'URGENTE',
        sintomas: 'Dificuldades de respiração durante esforço',
        status: 'AGUARDANDO',
        posicaoFila: 5,
        pacienteId: pacientesCriados[4].id,
        usuarioId: enfermeiro.id,
        tempoEspera: 9
      }
    ];

    for (const [index, senhaData] of senhas.entries()) {
      await prisma.senha.create({
        data: senhaData
      });
      console.log(`✅ Senha ${index + 1} criada: ${senhaData.codigo}`);
    }

    // Criar histórico médico para alguns pacientes
    console.log('📋 Criando histórico médico...');
    await prisma.historicoMedico.create({
      data: {
        descricao: 'Consulta de rotina - Crescimento adequado para idade',
        tipo: 'Consulta',
        data: new Date('2024-01-15'),
        pacienteId: pacientesCriados[0].id
      }
    });
    console.log('✅ Histórico 1 criado');

    await prisma.historicoMedico.create({
      data: {
        descricao: 'Exame de sangue - Hemograma completo normal',
        tipo: 'Exame',
        data: new Date('2024-01-20'),
        pacienteId: pacientesCriados[1].id
      }
    });
    console.log('✅ Histórico 2 criado');

    // Criar configurações do sistema
    console.log('⚙️ Criando configurações...');
    const configuracoes = [
      {
        chave: 'TEMPO_MEDIO_ATENDIMENTO',
        valor: '18',
        descricao: 'Tempo médio de atendimento em minutos',
        tipo: 'number'
      },
      {
        chave: 'MAX_PACIENTES_FILA',
        valor: '50',
        descricao: 'Número máximo de pacientes na fila',
        tipo: 'number'
      },
      {
        chave: 'HORARIO_FUNCIONAMENTO',
        valor: '{"inicio": "07:00", "fim": "18:00"}',
        descricao: 'Horário de funcionamento da pediatria',
        tipo: 'json'
      },
      {
        chave: 'PREFIXO_MUITO_URGENTE',
        valor: 'A',
        descricao: 'Prefixo para senhas muito urgentes',
        tipo: 'string'
      },
      {
        chave: 'PREFIXO_URGENTE',
        valor: 'B',
        descricao: 'Prefixo para senhas urgentes',
        tipo: 'string'
      },
      {
        chave: 'PREFIXO_POUCO_URGENTE',
        valor: 'C',
        descricao: 'Prefixo para senhas pouco urgentes',
        tipo: 'string'
      }
    ];

    for (const [index, config] of configuracoes.entries()) {
      await prisma.configuracao.create({
        data: config
      });
      console.log(`✅ Configuração ${index + 1} criada: ${config.chave}`);
    }

    // Criar alguns logs de exemplo
    console.log('📝 Criando logs do sistema...');
    await prisma.logSistema.create({
      data: {
        acao: 'SENHA_EMITIDA',
        entidade: 'SENHA',
        entidadeId: 'A001',
        detalhes: JSON.stringify({
          paciente: 'João Pedro Costa',
          prioridade: 'MUITO_URGENTE',
          sintomas: 'Febre alta há 3 dias'
        }),
        usuarioId: enfermeiro.id,
        timestamp: new Date()
      }
    });
    console.log('✅ Log criado');

    console.log('✅ Seed concluído com sucesso!');
    console.log('\n📊 Dados criados:');
    console.log(`- ${await prisma.usuario.count()} usuários`);
    console.log(`- ${await prisma.paciente.count()} pacientes`);
    console.log(`- ${await prisma.senha.count()} senhas`);
    console.log(`- ${await prisma.historicoMedico.count()} registos de histórico`);
    console.log(`- ${await prisma.configuracao.count()} configurações`);
    console.log(`- ${await prisma.logSistema.count()} logs`);
    
    console.log('\n🔑 Credenciais de acesso:');
    console.log('Admin: admin@hcm.mz / admin123');
    console.log('Médico: joao.silva@hcm.mz / medico123');
    console.log('Enfermeiro: maria.santos@hcm.mz / enfermeiro123');

  } catch (error) {
    console.error('❌ Erro durante o seed:');
    console.error(error);
    
    if (error instanceof Error) {
      console.error('Mensagem:', error.message);
      console.error('Stack:', error.stack);
    }
    
    throw error;
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Conexão fechada');
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Erro fatal durante o seed:');
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });