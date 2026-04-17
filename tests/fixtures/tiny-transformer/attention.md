# Attention Mechanism

<!-- scope: chapter 2 — scaled dot-product and multi-head attention
     deps: [[intro]]
     see-also: none
-->

## Overview

Attention lets every position in a sequence look at every other position in
one step. Scaled dot-product attention takes three matrices — queries (Q),
keys (K), and values (V) — and computes a weighted sum of values where the
weights come from query-key similarity.

```
Attention(Q, K, V) = softmax( Q K^T / sqrt(d_k) ) V
```

The sqrt(d_k) scaling prevents the dot products from growing large in high
dimensions, which would push softmax into regions of near-zero gradient.

## Key Concepts

- **Query, Key, Value**: projections of the same input (self-attention) or
  different inputs (cross-attention). Q asks "what do I need?", K answers
  "what do I have?", V provides the content.
- **Multi-Head Attention**: runs h attention heads in parallel on different
  linear projections of Q, K, V, then concatenates and projects the results.
  Allows the model to attend to information from different representation
  subspaces simultaneously.
- **Masked attention**: in the decoder, future positions are masked (set to
  -inf before softmax) to preserve autoregressive generation.

## Worked Example

For a sequence of length 4 with d_model = 8 and h = 2 heads (d_k = 4):

1. Project input X → Q, K, V each of shape [4, 8]
2. Split into 2 heads: each head sees Q, K, V of shape [4, 4]
3. Compute attention scores per head: [4, 4] matrix
4. Apply softmax row-wise; weight the V matrix
5. Concatenate heads → [4, 8]; project back to [4, 8]

## Questions

1. Why is division by sqrt(d_k) necessary — what breaks without it?
2. How does masking in decoder self-attention differ from encoder self-attention?
3. What does it mean for two heads to "attend to different subspaces"?
