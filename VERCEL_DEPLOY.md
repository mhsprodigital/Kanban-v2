# Guia de Deploy na Vercel

Este projeto está pronto para ser hospedado gratuitamente na [Vercel](https://vercel.com). Siga os passos abaixo para colocar seu sistema no ar.

## Passo 1: Exportar o Código
1. No Google AI Studio, clique no botão de configurações (engrenagem) ou opções do projeto.
2. Selecione **Export to GitHub** (ou baixe o arquivo ZIP e suba para um repositório no seu GitHub).

## Passo 2: Importar na Vercel
1. Crie uma conta ou faça login na [Vercel](https://vercel.com).
2. Clique em **Add New...** > **Project**.
3. Conecte sua conta do GitHub e selecione o repositório que você acabou de criar.
4. A Vercel detectará automaticamente que é um projeto **Vite**. As configurações padrão de Build (`npm run build`) e Output Directory (`dist`) já estarão corretas.

## Passo 3: Configurar Variáveis de Ambiente (Environment Variables)
Se o seu projeto utilizar a API do Gemini, você precisará configurar a chave de API na Vercel:
1. Na tela de importação do projeto na Vercel, abra a seção **Environment Variables**.
2. Adicione a seguinte variável:
   - **Key:** `GEMINI_API_KEY`
   - **Value:** `[Sua chave da API do Google Gemini]`
3. (Opcional) Se você configurou o Firebase manualmente usando variáveis de ambiente no futuro, adicione-as aqui também. Atualmente, o projeto utiliza o arquivo `firebase-applet-config.json` que já será enviado junto com o código.

## Passo 4: Deploy
1. Clique no botão **Deploy**.
2. Aguarde alguns minutos enquanto a Vercel instala as dependências e compila o projeto.
3. Pronto! Você receberá um link público (ex: `seu-projeto.vercel.app`) para acessar o sistema de qualquer lugar.

## Arquivo `vercel.json`
O arquivo `vercel.json` já foi incluído na raiz do projeto. Ele garante que o roteamento de Single Page Application (SPA) funcione perfeitamente, redirecionando todas as rotas para o `index.html` e evitando erros 404 ao recarregar a página.
