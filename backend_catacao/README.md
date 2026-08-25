# Backend de Inteligência Artificial AgroGIS - Detecção de Ervas Daninhas

Este módulo é um microserviço/backend em Python projetado para substituir o processo manual de catação de ervas daninhas, gerando um mapa (GeoJSON/Shapefile) pronto para importação no trator ou no aplicativo web.

## Como Funciona o Algoritmo

O script `gerador_mapa_catacao.py` executa o seguinte fluxo exato que foi mapeado da sua operação manual:

1. **Ingestão do Talhão:** Lê as bordas reais do talhão.
2. **Gradeamento de Precisão (40x40m):** Usa a biblioteca GeoPandas e a projeção exata UTM local para recortar o interior do talhão em polígonos de exatamente 40x40 metros (que abrigam perfeitamente 16 pixels de um satélite Sentinel-2).
3. **Cruzamento com Imagem de Satélite:** (Parte simulada no script atual usando *clusters*, mas preparada estruturalmente para leitura de satélite via `rasterstats`). O algoritmo analisa o Índice de Vegetação (NDVI/SAVI) de cada quadrado de 40m e classifica se a "assinatura" espectral corresponde a ervas daninhas.
4. **Dissolve (Merge):** Todos os polígonos classificados como "Mato" são aglomerados em manchas maiores.
5. **Clipping:** As manchas são recortadas pelos limites exatos do talhão original para não ultrapassar a cerca/borda.
6. **Exportação:** Salva o arquivo `mapa_catacao_resultado.geojson` contendo as exatas manchas de aplicação localizada.

## Como Instalar e Rodar na sua Máquina

1. Certifique-se de que possui o Python instalado (recomenda-se usar o Anaconda/Miniconda, pois gerencia dependências geoespaciais mais facilmente).
2. Instale as bibliotecas rodando no terminal do VSCode ou Prompt de Comando:
   ```bash
   pip install geopandas rasterio rasterstats shapely numpy matplotlib
   ```
3. Execute o script:
   ```bash
   python gerador_mapa_catacao.py
   ```
   *Nota: Se você rodar o script agora, ele criará automaticamente um talhão de teste e já processará a saída para você ver o funcionamento.*

## Próximo Passo Real: Integrando com Imagens TIF

No script `gerador_mapa_catacao.py`, vá até a função `process_mapa_catacao`. No passo [3/6], você verá a chamada para `simulate_weed_detection`.
Quando você tiver suas imagens TIF (Sentinel-2, Planet ou Drone) baixadas, basta substituir por `rasterstats`:

```python
from rasterstats import zonal_stats

# Exemplo de código real
stats = zonal_stats(grid_gdf, 'caminho/para/imagem_satelite_ndvi.tif', stats="mean")
grid_gdf['ndvi_mean'] = [s['mean'] for s in stats]
```

Isso fará com que o algoritmo extraia o valor real dos pixels da imagem em vez de simular as reboleiras!
