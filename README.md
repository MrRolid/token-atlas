You can explore individual tokens, their numerical representations, and their similarities to one another. The matrix displays one million pairwise relationships. While generating a response, you can see the probabilities of the next tokens as well as the actual weights used by the attention mechanism.

The application helps explain how a model works with context, how a response is generated token by token, and how temperature affects token selection. It also demonstrates why a high probability does not necessarily mean that something is true, and why token similarity is not the same thing as attention during the processing of a specific question.

**This is not just a pre-rendered animation.** Under the hood, an actually trained transformer with two layers and 137,320 parameters performs the calculations. It is, however, an educational mini-model with limited knowledge, not a general-purpose large LLM. It may fail on unfamiliar questions. The 3D visualization is a projection of multidimensional data, and the animated connections should not be interpreted as the literal path taken by the algorithm.

Czech and English models are available, the interface supports three languages, and compatible custom models can be imported. The visualization uses WebGPU with a WebGL2 fallback. Queries are processed locally, without using any external AI API.

Live demo: https://vorel.eu/edu/token-atlas/
<img width="1242" height="864" alt="image" src="https://github.com/user-attachments/assets/c1990d6e-8d63-464f-8441-03209319bf04" />
