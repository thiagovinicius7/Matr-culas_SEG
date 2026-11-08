import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import VivenciaPublica from './components/VivenciaPublica';
import SituacaoMatriculaPublica from './components/SituacaoMatriculaPublica';
import './index.css';

// Link público das Vivências (?vivencias=1 ou ?vivencia=<id>): abre uma página
// separada, sem passar pelo App principal — a família não carrega nenhum dado
// de alunos, só as vivências abertas.
const params = new URLSearchParams(window.location.search);
const vivenciaId = params.get('vivencia');
const ehVivencia = !!vivenciaId || params.get('vivencias') === '1';
// Link público da situação da matrícula 2027 (?situacao=1): a família consulta pelo CPF.
const ehSituacao = params.get('situacao') === '1';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {ehSituacao ? <SituacaoMatriculaPublica /> : ehVivencia ? <VivenciaPublica vivenciaIdInicial={vivenciaId} /> : <App />}
  </StrictMode>,
);
