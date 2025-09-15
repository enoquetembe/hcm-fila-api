// src/controllers/relatorio-controller.ts
import { FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { format, subDays, startOfWeek, startOfMonth, startOfYear, endOfWeek, endOfMonth, endOfYear } from 'date-fns'

const gerarRelatorioSchema = z.object({
  tipo: z.enum(['DIARIO', 'SEMANAL', 'MENSAL', 'ANUAL', 'PERSONALIZADO']),
  dataInicio: z.string().optional(),
  dataFim: z.string().optional(),
  prioridades: z.array(z.enum(['MUITO_URGENTE', 'URGENTE', 'POUCO_URGENTE'])).optional(),
  turnos: z.array(z.string()).optional(),
  faixasEtarias: z.array(z.string()).optional()
})

export class RelatorioController {
  async gerarRelatorio(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { tipo, dataInicio, dataFim, prioridades, turnos, faixasEtarias } = gerarRelatorioSchema.parse(request.body)
      const userId = (request as any).userId

      // Definir datas baseadas no tipo de relatório
      let dataInicioFiltro: Date
      let dataFimFiltro: Date = new Date()

      switch (tipo) {
        case 'DIARIO':
          dataInicioFiltro = new Date()
          dataInicioFiltro.setHours(0, 0, 0, 0)
          dataFimFiltro.setHours(23, 59, 59, 999)
          break
        case 'SEMANAL':
          dataInicioFiltro = startOfWeek(new Date())
          dataFimFiltro = endOfWeek(new Date())
          break
        case 'MENSAL':
          dataInicioFiltro = startOfMonth(new Date())
          dataFimFiltro = endOfMonth(new Date())
          break
        case 'ANUAL':
          dataInicioFiltro = startOfYear(new Date())
          dataFimFiltro = endOfYear(new Date())
          break
        case 'PERSONALIZADO':
          dataInicioFiltro = new Date(dataInicio || subDays(new Date(), 7))
          dataFimFiltro = new Date(dataFim || new Date())
          break
        default:
          dataInicioFiltro = subDays(new Date(), 7)
      }

      // Gerar dados do relatório
      const dadosRelatorio = await this.gerarDadosRelatorio(
        dataInicioFiltro,
        dataFimFiltro,
        prioridades,
        turnos,
        faixasEtarias
      )

      // Criar registro do relatório
      const relatorio = await prisma.relatorio.create({
        data: {
          tipo,
          titulo: `Relatório ${tipo.toLowerCase()} - ${format(dataInicioFiltro, 'dd/MM/yyyy')} a ${format(dataFimFiltro, 'dd/MM/yyyy')}`,
          periodo: `${format(dataInicioFiltro, 'yyyy-MM-dd')} to ${format(dataFimFiltro, 'yyyy-MM-dd')}`,
          dadosJson: JSON.stringify(dadosRelatorio),
          usuarioId: 'cmfl2x6790000ujtcp567bqma',
          dataInicio: dataInicioFiltro,
          dataFim: dataFimFiltro,
          prioridades: prioridades ? JSON.stringify(prioridades) : null,
          turnos: turnos ? JSON.stringify(turnos) : null,
          faixasEtarias: faixasEtarias ? JSON.stringify(faixasEtarias) : null
        }
      })

      // Log da geração do relatório
      await prisma.logSistema.create({
        data: {
          acao: 'RELATORIO_GERADO',
          entidade: 'RELATORIO',
          entidadeId: relatorio.id,
          detalhes: JSON.stringify({
            tipo: relatorio.tipo,
            periodo: relatorio.periodo
          }),
          usuarioId: 'cmfl2x6790000ujtcp567bqma',
          ipAddress: request.ip
        }
      })

      reply.code(201).send({ relatorio })
    } catch (error) {
      console.error('Erro ao gerar relatório:', error)
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ 
          error: 'Dados inválidos',
          details: error.errors 
        })
      }
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  }

  async listarRelatorios(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { page = 1, limit = 20 } = request.query as { page?: number; limit?: number }
      const userId = (request as any).userId

      const [relatorios, total] = await Promise.all([
        prisma.relatorio.findMany({
          where: { usuarioId: 'cmfl2x6790000ujtcp567bqma' },
          orderBy: { geradoEm: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            usuario: {
              select: {
                nome: true,
                email: true
              }
            }
          }
        }),
        prisma.relatorio.count({ where: { usuarioId: 'cmfl2x6790000ujtcp567bqma' } })
      ])

      reply.code(200).send({
        relatorios,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      })
    } catch (error) {
      console.error('Erro ao listar relatórios:', error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  }

  async getRelatorioById(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string }
      const userId = (request as any).userId

      const relatorio = await prisma.relatorio.findFirst({
        where: { 
          id,
          usuarioId: 'cmfl2x6790000ujtcp567bqma' 
        },
        include: {
          usuario: {
            select: {
              nome: true,
              email: true
            }
          }
        }
      })

      if (!relatorio) {
        return reply.code(404).send({ error: 'Relatório não encontrado' })
      }

      reply.code(200).send({ relatorio })
    } catch (error) {
      console.error('Erro ao buscar relatório:', error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  }

  async downloadRelatorio(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string }
      const { formato = 'json' } = request.query as { formato?: string }
      const userId = (request as any).userId

      const relatorio = await prisma.relatorio.findFirst({
        where: { 
          id,
          usuarioId: 'cmfl2x6790000ujtcp567bqma' 
        }
      })

      if (!relatorio) {
        return reply.code(404).send({ error: 'Relatório não encontrado' })
      }

      const dados = JSON.parse(relatorio.dadosJson)

      // Converter para o formato solicitado
      let conteudo: string
      let contentType: string
      let extensao: string

      switch (formato) {
        case 'csv':
          conteudo = this.converterParaCSV(dados)
          contentType = 'text/csv'
          extensao = 'csv'
          break
        case 'json':
        default:
          conteudo = relatorio.dadosJson
          contentType = 'application/json'
          extensao = 'json'
          break
      }

      // Log do download
      await prisma.logSistema.create({
        data: {
          acao: 'RELATORIO_BAIXADO',
          entidade: 'RELATORIO',
          entidadeId: id,
          detalhes: JSON.stringify({ formato }),
          usuarioId: 'cmfl2x6790000ujtcp567bqma',
          ipAddress: request.ip
        }
      })

      reply
        .header('Content-Type', contentType)
        .header('Content-Disposition', `attachment; filename="${relatorio.titulo}.${extensao}"`)
        .send(conteudo)
    } catch (error) {
      console.error('Erro ao baixar relatório:', error)
      reply.code(500).send({ error: 'Erro interno do servidor' })
    }
  }

  private async gerarDadosRelatorio(
    dataInicio: Date,
    dataFim: Date,
    prioridades?: string[],
    turnos?: string[],
    faixasEtarias?: string[]
  ) {
    // Construir filtros para a consulta
    const where: any = {
      emitidaEm: {
        gte: dataInicio,
        lte: dataFim
      }
    }

    if (prioridades && prioridades.length > 0) {
      where.prioridade = { in: prioridades }
    }

    // Buscar dados das senhas
    const senhas = await prisma.senha.findMany({
      where,
      include: {
        paciente: true,
        usuario: {
          select: {
            nome: true,
            email: true
          }
        }
      },
      orderBy: {
        emitidaEm: 'asc'
      }
    })

    // Buscar dados de atendimentos
    const atendimentos = await prisma.atendimento.findMany({
      where: {
        iniciadoEm: {
          gte: dataInicio,
          lte: dataFim
        }
      },
      include: {
        paciente: true,
        senha: true
      }
    })

    // Calcular estatísticas
    const estatisticas = {
      totalSenhas: senhas.length,
      senhasPorPrioridade: {
        MUITO_URGENTE: senhas.filter(s => s.prioridade === 'MUITO_URGENTE').length,
        URGENTE: senhas.filter(s => s.prioridade === 'URGENTE').length,
        POUCO_URGENTE: senhas.filter(s => s.prioridade === 'POUCO_URGENTE').length
      },
      senhasPorStatus: {
        AGUARDANDO: senhas.filter(s => s.status === 'AGUARDANDO').length,
        CHAMANDO: senhas.filter(s => s.status === 'CHAMANDO').length,
        EM_ATENDIMENTO: senhas.filter(s => s.status === 'EM_ATENDIMENTO').length,
        ATENDIDO: senhas.filter(s => s.status === 'ATENDIDO').length,
        CANCELADO: senhas.filter(s => s.status === 'CANCELADO').length,
        NAO_COMPARECEU: senhas.filter(s => s.status === 'NAO_COMPARECEU').length
      },
      tempoMedioEspera: this.calcularTempoMedioEspera(senhas),
      tempoMedioAtendimento: this.calcularTempoMedioAtendimento(atendimentos),
      totalAtendimentos: atendimentos.length,
      atendimentosConcluidos: atendimentos.filter(a => a.status === 'FINALIZADO').length,
      pacientesAtendidos: new Set(atendimentos.map(a => a.pacienteId)).size
    }

    // Preparar dados detalhados
    const detalhes = senhas.map(senha => ({
      codigo: senha.codigo,
      prioridade: senha.prioridade,
      status: senha.status,
      paciente: {
        nome: senha.paciente.nomeCompleto,
        idade: senha.paciente.idade,
        numeroIdentificacao: senha.paciente.numeroIdentificacao
      },
      sintomas: senha.sintomas,
      emitidaEm: senha.emitidaEm,
      tempoEspera: senha.tempoEspera,
      usuarioEmissor: senha.usuario?.nome
    }))

    return {
      estatisticas,
      detalhes,
      periodo: {
        inicio: dataInicio,
        fim: dataFim
      },
      geradoEm: new Date()
    }
  }

  private calcularTempoMedioEspera(senhas: any[]): number {
    const senhasComTempo = senhas.filter(s => s.tempoEspera && s.tempoEspera > 0)
    if (senhasComTempo.length === 0) return 0
    
    const total = senhasComTempo.reduce((sum, senha) => sum + (senha.tempoEspera || 0), 0)
    return Math.round(total / senhasComTempo.length)
  }

  private calcularTempoMedioAtendimento(atendimentos: any[]): number {
    const atendimentosComDuracao = atendimentos.filter(a => a.duracaoMinutos && a.duracaoMinutos > 0)
    if (atendimentosComDuracao.length === 0) return 0
    
    const total = atendimentosComDuracao.reduce((sum, atendimento) => sum + (atendimento.duracaoMinutos || 0), 0)
    return Math.round(total / atendimentosComDuracao.length)
  }

  private converterParaCSV(dados: any): string {
    const { estatisticas, detalhes } = dados
    
    let csv = 'Relatório HCM - Sistema de Monitoria\n\n'
    
    // Estatísticas
    csv += 'ESTATÍSTICAS\n'
    csv += 'Metrica,Valor\n'
    Object.entries(estatisticas).forEach(([key, value]) => {
      if (typeof value === 'object') {
        Object.entries(value).forEach(([subKey, subValue]) => {
          csv += `${key}.${subKey},${subValue}\n`
        })
      } else {
        csv += `${key},${value}\n`
      }
    })
    
    csv += '\nDETALHES\n'
    if (detalhes.length > 0) {
      // Cabeçalhos
      const headers = Object.keys(detalhes[0])
      csv += headers.join(',') + '\n'
      
      // Dados
      detalhes.forEach((item: any) => {
        const row = headers.map(header => {
          const value = item[header]
          if (typeof value === 'object') {
            return JSON.stringify(value).replace(/"/g, '""')
          }
          return `"${String(value).replace(/"/g, '""')}"`
        })
        csv += row.join(',') + '\n'
      })
    }
    
    return csv
  }
}