# Transformers: Introduction

<!-- scope: chapter 1 — what transformers are and why they replaced RNNs
     deps: none
     see-also: [[attention]]
-->

## Overview

A transformer is a sequence-to-sequence model that relies entirely on
self-attention, discarding the recurrence used by RNNs and LSTMs. Introduced
in "Attention Is All You Need" (Vaswani et al., 2017), the architecture
became the foundation for GPT, BERT, and virtually every modern large language
model.

Key advantages over RNNs:
- Parallelisable training (no sequential bottleneck)
- Long-range dependencies captured directly via attention
- Scales predictably with compute and data

## Architecture at a Glance

```
Input tokens
    |
[Embedding + Positional Encoding]
    |
[Encoder Stack]  —  N identical layers, each with:
    |                 • Multi-Head Self-Attention
    |                 • Feed-Forward Network
    |                 • Layer Norm + Residual
    |
[Decoder Stack]  —  N identical layers, each with:
                      • Masked Self-Attention
                      • Cross-Attention (encoder output)
                      • Feed-Forward Network
                      • Layer Norm + Residual
```

## Key Concepts

- **Token embedding**: maps discrete token IDs to dense vectors
- **Positional encoding**: injects sequence-order information (sine/cosine or learned)
- **Residual connection**: adds input back to output of each sublayer, aiding gradient flow
- **Layer normalisation**: stabilises training by normalising activations

## Questions

1. Why does removing recurrence enable parallelisation?
2. What information does positional encoding carry that embeddings alone cannot?
3. What role do residual connections play during backpropagation?
