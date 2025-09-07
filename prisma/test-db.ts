// test-db.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function test() {
  try {
    console.log('🔗 Testando conexão com o banco de dados...');
    await prisma.$connect();
    console.log('✅ Conectado ao banco de dados');
    
    // Verificar se o banco está acessível
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Query de teste executada com sucesso:', result);
    
    // Tentar criar um registro simples
    console.log('🧪 Criando usuário teste...');
    const testUser = await prisma.usuario.create({
      data: {
        nome: 'Test User',
        email: 'test@test.com',
        senha: 'test123',
        role: 'ADMIN'
      }
    });
    console.log('✅ Usuário teste criado:', testUser.id);
    
    // Contar registros
    const count = await prisma.usuario.count();
    console.log(`📊 Total de usuários: ${count}`);
    
    // Limpar o teste
    await prisma.usuario.deleteMany({ where: { email: 'test@test.com' } });
    console.log('🧹 Usuário teste removido');
    
  } catch (error) {
    console.error('❌ Erro durante o teste:');
    console.error(error);
    
    if (error instanceof Error) {
      console.error('Mensagem:', error.message);
      console.error('Stack:', error.stack);
    }
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Conexão fechada');
  }
}

test();