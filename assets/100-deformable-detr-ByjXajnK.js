const e=`---
title: Deformable DETR
date: 2022-10-27
id: blog0100
tag: deep-learning, pytorch
wip: true
intro: Code implementation of deformable DETR.
---

### Short Review of DETR

To be finished.

### DeformableDETR

#### From MultiHeadAttention to DeformableHeadAttention

##### MultiHeadAttention

We have a throughout revie of transformer in [this blog post](/blog/article/Transformer-1-The-Model-Definition-and-Naive-Training-Dataset-for-Machine-Translation#Repeated-Use-of-ScaledDotProductAttention:-Multi-head-Attention), for comparison purpose let's copy the code block here:

\`\`\`python
class MultiHeadAttention(nn.Module):
    def __init__(self):
        super(MultiHeadAttention, self).__init__()
        self.W_Q = nn.Linear(d_model, d_k * n_heads, bias=False)
        self.W_K = nn.Linear(d_model, d_k * n_heads, bias=False)
        self.W_V = nn.Linear(d_model, d_v * n_heads, bias=False)
        self.fc = nn.Linear(n_heads * d_v, d_model, bias=False)

    def forward(self, input_Q, input_K, input_V, attn_mask):
        '''
        input_Q: [batch_size, len_q, d_model]
        input_K: [batch_size, len_k, d_model]
        input_V: [batch_size, len_v(=len_k), d_model]
        attn_mask: [batch_size, seq_len, seq_len]
        '''
        residual, batch_size = input_Q, input_Q.size(0)
        # (B, S, D) -proj-> (B, S, D_new) -split-> (B, S, H, W) -trans-> (B, H, S, W)
        # Q: [batch_size, n_heads, len_q, d_k]
        Q = self.W_Q(input_Q).view(batch_size, -1, n_heads, d_k).transpose(1, 2)
        # K: [batch_size, n_heads, len_k, d_k]
        K = self.W_K(input_K).view(batch_size, -1, n_heads, d_k).transpose(1, 2)
        # V: [batch_size, n_heads, len_v(=len_k), d_v]
        V = self.W_V(input_V).view(batch_size, -1, n_heads, d_v).transpose(1, 2)

        # attn_mask : [batch_size, n_heads, seq_len, seq_len]
        attn_mask = attn_mask.unsqueeze(1).repeat(1, n_heads, 1, 1)

        # context: [batch_size, n_heads, len_q, d_v], attn: [batch_size, n_heads, len_q, len_k]
        context, attn = ScaledDotProductAttention()(Q, K, V, attn_mask)
        # context: [batch_size, len_q, n_heads * d_v]
        context = context.transpose(1, 2).reshape(
            batch_size, -1, n_heads * d_v)
        output = self.fc(context)  # [batch_size, len_q, d_model]
        return nn.LayerNorm(d_model).to(device)(output + residual), attn
\`\`\`

##### DeformableHeadAttention

\`\`\`python
def phi(width: int,height: int, p_q: torch.Tensor):
    new_point = p_q.clone().detach()
    new_point[..., 0] = new_point[..., 0] * (width - 1)
    new_point[..., 1] = new_point[..., 1] * (height - 1)

    return new_point

def generate_ref_points(width: int,
                        height: int):
    grid_y, grid_x = torch.meshgrid(torch.arange(0, height), torch.arange(0, width))
    grid_y = grid_y / (height - 1)
    grid_x = grid_x / (width - 1)

    grid = torch.stack((grid_x, grid_y), 2).float()
    grid.requires_grad = False
    return grid


class DeformableHeadAttention(nn.Module):
    """Deformable Attention Module"""
    def __init__(self, last_height, last_width, C, M=8, K=4, L=1, dropout=0.1, return_attentions=False):
        """
        Args:
            - param C: emebedding size of the x's
            - param M: number of attention heads
            - param K: number of sampling points per attention head per feature level
            - param L: number of scale
            - param last_height: smallest feature height
            - param last_width: smallest feature width
            - param dropout: dropout ratio default =0.1,
            - param return_attentions: boolean, return attentions or not default = False
        """
        super(DeformableHeadAttention, self).__init__()
        assert C % M == 0  # check if C is divisible by M
        self.C_v = C // M
        self.M = M
        self.L = L
        self.K = K
        self.q_proj = nn.Linear(C, C)
        self.W_prim = nn.Linear(C, C)
        self.dimensions = [[last_height * 2**i, last_width * 2**i] for i in range(self.L)]
        self.dropout = None
        if dropout > 0:
            self.dropout = nn.Dropout(p=dropout)
        # 2MLK for offsets MLK for A_mlqk
        self.delta_proj = nn.Linear(C, 2 * M * L * K)  # delta p_q 2 *L* M * K
        self.Attention_projection = nn.Linear(C, M * K * L)  # K probabilities per M and L

        self.W_m = nn.Linear(C, C)
        self.return_attentions = True
        self.init_parameters()

    def forward(self, z_q, Xs, p_q, query_mask=None, x_masks=None):
        """
        Args:
        - param x_masks: batch, Height, Width
        - param query_mask: batch, H, W
        - param z_q: batch, H, W, C, query tensors
        - param Xs: List[batch, H, W, C] list of tensors representing multiscal image
        - param p_q: reference point 1 per pixel B, H, W, 2
        - return features                   Batch, Height, Width , C
                Attention                  Batch, Height, Width, L, M, K
        """
        #
        if x_masks is None:
            x_masks = [None] * len(Xs)

        output = {'attentions': None, 'deltas': None}

        B, H, W, _ = z_q.shape

        # B, H, W, C
        z_q = self.q_proj(z_q)

        # B, H, W, 2MLK
        deltas = self.delta_proj(z_q)
        # B, H, W, M, 2LK
        deltas = deltas.view(B, H, W, self.M, -1)

        # B, H, W, MLK
        A = self.Attention_projection(z_q)

        # put at - infinity probas masked (batch, H, W, 1)
        if query_mask is not None:
            query_mask_ = query_mask.unsqueeze(dim=-1)
            _, _, _, M_L_K = A.shape
            query_mask_ = query_mask_.expand(B, H, W, M_L_K)
            A = torch.masked_fill(A, mask=query_mask_, value=float('-inf'))

        # batch, H, W, M, L*K
        A = A.view(B, H, W, self.M, -1)
        A = F.softmax(A, dim=-1)  # soft max over the L*K probabilities

        # mask nan position
        if query_mask is not None:
            # Batch, H, W, 1, 1
            query_mask_ = query_mask.unsqueeze(dim=-1).unsqueeze(dim=-1)
            A = torch.masked_fill(A, query_mask_.expand_as(A), 0.0)  # mask the possible nan values

        if self.return_attentions:
            output['attentions'] = A  # batch, H, W, M, L*K
            output['deltas'] = deltas  # B, H, W, M, 2LK

        deltas = deltas.view(B, H, W, self.M, self.L, self.K, 2)  # batch , H, W, M, L, K, 2
        deltas = deltas.permute(0, 3, 4, 5, 1, 2, 6).contiguous()  # Batch, M, L, K, H, W, 2
        # Bacth * M, L, K, H, W, 2
        deltas = deltas.view(B * self.M, self.L, self.K, H, W, 2)

        A = A.permute(0, 3, 1, 2, 4).contiguous()  # batch, M, H, W, L*K
        A = A.view(B * self.M, H * W, -1)  # Batch *M, H*W, LK
        sampled_features_scale_list = []
        for l in range(self.L):
            x_l = Xs[l]  # N H W C
            _, h, w, _ = x_l.shape

            x_l_mask = x_masks[l]

            # Batch, H, W, 2
            phi_p_q = phi(height=h, width=w, p_q=p_q)  # phi multiscale
            # B, H, W, 2 -> B*M, H, W, 2
            phi_p_q = phi_p_q.repeat(self.M, 1, 1, 1)  # repeat M points for every attention head
            # B, h, w, M, C_v
            W_prim_x = self.W_prim(x_l)
            W_prim_x = W_prim_x.view(B, h, w, self.M, self.C_v)  # Separate the C features into M*C_v vectors
            # shape  batch, h( x_l ), w( x_l ), M, C_v

            if x_l_mask is not None:  # si un masque est present
                # B, h, w, 1, 1
                x_l_mask = x_l_mask.unsqueeze(dim=-1).unsqueeze(dim=-1)
                x_l_mask = x_l_mask.expand(B, h, w, self.M, self.C_v)
                W_prim_x = torch.masked_fill(W_prim_x, mask=x_l_mask, value=0)  # ne pas prendre en compte

            # Batch, M, C_v, h, w
            W_prim_x = W_prim_x.permute(0, 3, 4, 1, 2).contiguous()
            # Batch *M, C_v, h, w
            W_prim_x = W_prim_x.view(-1, self.C_v, h, w)
            # B*M, k, C_v, H, W
            sampled_features = self.compute_sampling(W_prim_x, phi_p_q, deltas, l, h, w)

            sampled_features_scale_list.append(sampled_features)

        # B*M, L, K, C_v, H, W
        # stack L (Batch *M, K, C_v, H, W) sampled features
        sampled_features_scaled = torch.stack(sampled_features_scale_list, dim=1)
        # B*M, H*W, C_v, LK
        sampled_features_scaled = sampled_features_scaled.permute(0, 4, 5, 3, 1, 2).contiguous()
        sampled_features_scaled = sampled_features_scaled.view(B * self.M, H * W, self.C_v, -1)
        # sampled_features_scaled (n B*M ,l H*W ,d C_v ,LK)
        # A (n B*M, l H*W ,s L*K)
        # result of the sum of product  (n B*M , l H*W, d C_v)  B*M, H*W, C_v
        Attention_W_prim_x_plus_delta = torch.einsum('nlds, nls -> nld', sampled_features_scaled, A)

        # B, M, H, W, C_v
        Attention_W_prim_x_plus_delta = Attention_W_prim_x_plus_delta.view(B, self.M, H, W, self.C_v)
        # B, H, W, M, C_v
        Attention_W_prim_x_plus_delta = Attention_W_prim_x_plus_delta.permute(0, 2, 3, 1, 4).contiguous()
        # B, H, W, M * C_v
        Attention_W_prim_x_plus_delta = Attention_W_prim_x_plus_delta.view(B, H, W, self.C_v * self.M)

        final_features = self.W_m(Attention_W_prim_x_plus_delta)
        if self.dropout:
            final_features = self.dropout(final_features)

        return final_features, output

    def compute_sampling(self, W_prim_x, phi_p_q, deltas, layer, h, w):
        offseted_features = []
        for k in range(self.K):  # for K points
            phi_p_q_plus_deltas = phi_p_q + deltas[:, layer, k, :, :, :]  # p_q + delta p_mqk
            vgrid_x = 2.0 * phi_p_q_plus_deltas[:, :, :, 0] / max(w - 1, 1) - 1.0  # copied
            vgrid_y = 2.0 * phi_p_q_plus_deltas[:, :, :, 1] / max(h - 1, 1) - 1.0  # copied
            vgrid_scaled = torch.stack((vgrid_x, vgrid_y), dim=3)  # stack the

            # B*M, C_v, H, W
            # bilinear interpolation as explained in deformable convolution

            sampled = F.grid_sample(W_prim_x, vgrid_scaled, mode='bilinear', padding_mode='zeros')
            offseted_features.append(sampled)
        return torch.stack(offseted_features, dim=3)

    def init_parameters(self):
        torch.nn.init.constant_(self.delta_proj.weight, 0.0)
        torch.nn.init.constant_(self.Attention_projection.weight, 0.0)

        torch.nn.init.constant_(self.Attention_projection.bias, 1 / (self.L * self.K))

        def init_xy(bias, x, y):
            torch.nn.init.constant_(bias[:, 0], float(x))
            torch.nn.init.constant_(bias[:, 1], float(y))

        # caution: offset layout will be  M, L, K, 2
        bias = self.delta_proj.bias.view(self.M, self.L, self.K, 2)

        init_xy(bias[0], x=-self.K, y=-self.K)
        init_xy(bias[1], x=-self.K, y=0)
        init_xy(bias[2], x=-self.K, y=self.K)
        init_xy(bias[3], x=0, y=-self.K)
        init_xy(bias[4], x=0, y=self.K)
        init_xy(bias[5], x=self.K, y=-self.K)
        init_xy(bias[6], x=self.K, y=0)
        init_xy(bias[7], x=self.K, y=self.K)
\`\`\`

#### DeformableTransformerEncoder

\`\`\`python
class DeformableTransformerEncoderLayer(nn.Module):
    def __init__(self, C, M, K, n_levels, last_feat_height, last_feat_width, d_ffn=2048,
                 dropout=0.1, normalize_before=False):
        super().__init__()
        """
        Args:
            - C: Number of expected features in the encoder inputs.
            - M: number of attention heads.
            - K: number of sampling points.
            - n_levels: multiscale parameter.
            - last_feat_height : smallest feature height.
            - last_feat_width : smallest feature width.
            - d_ffn : feed forward network dimension.
        """
        # self attention
        self.self_attn = DeformableHeadAttention(
            last_height=last_feat_height,
            last_width=last_feat_width,
            C=C,
            M=M,
            K=K,
            L=n_levels,
            dropout=dropout,
            return_attentions=False)
        self.dropout1 = nn.Dropout(dropout)
        self.norm1 = nn.LayerNorm(C)
        self.norm2 = nn.LayerNorm(C)
        self.norm3 = nn.LayerNorm(C)
        self.normalize_before = normalize_before
        self.ffn = FeedForward(C, d_ffn, dropout)

    def forward(self, input_features, ref_points, input_masks=None, padding_masks=None, pos_encodings=None):
        """
        Args:
            - input_features : the sequence to the encoder.
            - ref_points : reference points.
            - input_masks : the mask for the input keys.
            - padding_masks : masks for padded inputs.
            - pos_embeddings : positional embeddings passed to the transformer.
        """
        if self.normalize_before:
            return self.forward_pre_norm(input_features, ref_points, input_masks, padding_masks, pos_encodings)
        return self.forward_post_norm(input_features, ref_points, input_masks, padding_masks, pos_encodings)

    def forward_pre_norm(self, input_features, ref_points, input_masks=None, padding_masks=None, pos_encodings=None):
        if input_masks is None:
            input_masks = [None] * len(input_features)

        if padding_masks is None:
            padding_masks = [None] * len(input_features)

        if pos_encodings is None:
            pos_encodings = [None] * len(pos_encodings)
        feats = []
        features = [feature + pos for (feature, pos) in zip(input_features, pos_encodings)]  # add pos encodings to features
        for q, ref_point, key_padding_mask, pos in zip(features, ref_points, padding_masks, pos_encodings):
            feat = self.norm1(q)  # pre normalization
            feat, attention = self.self_attn(feat, features, ref_point, key_padding_mask, padding_masks)
            q = q + self.dropout1(feat)
            q = self.norm2(q)
            q = self.ffn(q)
            feats.append(q)

        return feats
    def forward_post_norm(self, input_features, ref_points, input_masks=None, padding_masks=None,
                          pos_encodings=None):
        if input_masks is None:
            input_masks = [None] * len(input_features)

        if padding_masks is None:
            padding_masks = [None] * len(input_features)

        if pos_encodings is None:
            pos_encodings = [None] * len(pos_encodings)
        feats = []
        features = [feature + pos for (feature, pos) in zip(input_features, pos_encodings)]  # add pos encodings to features
        for q, ref_point, key_padding_mask, pos in zip(features, ref_points, padding_masks, pos_encodings):
            feat, attention = self.self_attn(q, features, ref_point, key_padding_mask, padding_masks)
            q = q + self.dropout1(feat)
            q = self.norm1(q)
            q = self.ffn(q)
            q = self.norm2(q)  # post normalization
            feats.append(q)
        return feats


class DeformableTransformerEncoder(nn.Module):
    def __init__(self, encoder_layer, num_layers, norm=None):
        """
        Args:
            - decoder_layer: an instance of the DeformableTransformerEncoderLayer() class.
            - num_layers: the number of sub-decoder-layers in the decoder.
            - norm: the layer normalization component (optional).
        """
        super().__init__()
        self.layers = nn.ModuleList([copy.deepcopy(encoder_layer) for i in range(num_layers)])
        self.num_layers = num_layers
        self.norm = norm

    def forward(self, input_features, ref_points, input_masks=None, pos_encodings=None, padding_mask=None):
        output = input_features
        for layer in self.layers:
            outputs = layer(output, ref_points, input_masks=input_masks, padding_masks=padding_mask, pos_encodings=pos_encodings)
        if self.norm is not None:
            for i, output in enumerate(outputs):
                outputs[i] = self.norm(output)
        return outputs


class FeedForward(nn.Module):
    """Simple Feed Forward Network"""

    def __init__(self, C=256, d_ffn=1024, dropout=0.1):
        super(FeedForward, self).__init__()
        self.C = C
        self.d_ffn = d_ffn
        self.linear1 = nn.Linear(C, d_ffn)
        self.dropout1 = nn.Dropout(dropout)
        self.linear2 = nn.Linear(d_ffn, C)
        self.dropout2 = nn.Dropout(dropout)

    def forward(self, attended):
        attended_tmp = self.linear2(self.dropout1(F.relu(self.linear1(attended))))
        attended = attended + self.dropout2(attended_tmp)
        return attended

\`\`\`

#### DeformableTransformerDecoder

\`\`\`python
class DeformableTransformerDecoderLayer(nn.Module):
    def __init__(self, C, M, K, n_levels, last_feat_height, last_feat_width, d_ffn=1024, dropout=0.1, normalize_before=False):
        super().__init__()
        """
        Args:
            - C: Number of expected features in the decoder inputs.
            - d_ffn : feed forward network dimension.
            - n_levels: multiscale parameter.
            - M: number of attention heads.
            - K: number of sampling points.
        """
        # Deformable Attention part
        self.def_attn = DeformableHeadAttention(last_height = last_feat_height,last_width = last_feat_width, C = C, M=M, K=K, L = n_levels, dropout=dropout, return_attentions = False)
        self.dropout1 = nn.Dropout(dropout)
        self.norm1 = nn.LayerNorm(C)
        self.norm2 = nn.LayerNorm(C)
        self.norm3 = nn.LayerNorm(C)
        # Proper Attention Part
        self.self_attn = nn.MultiheadAttention(C, M, dropout=dropout)
        self.dropout2 = nn.Dropout(dropout)
        self.normalize_before = normalize_before
        # the feed forward network
        self.ffn = FeedForward(C, d_ffn)

    def forward(self, query_objects, out_encoder, ref_points, tgt_mask = None, memory_masks = None,
                tgt_key_padding_mask = None, memory_key_padding_masks = None,positional_embeddings = None,
                query_poses = None):
        """
        Args:
            - query_objects : query_embedding passed to the transformer.
            - out_encoder : result of the encoder.
            - ref_points : linear projection of tgt to 2 dim (in the encoder).
            - memory_key_padding_masks : the mask passed to the transformer.
            - tgt_key_padding_mask : the mask for target keys per batch.
            - positional_embeddings : positional embeddings passed to the transformer.
            - query_poses : query_embed passed to the transformer.
        """
        if self.normalize_before:
            return self.forward_pre_norm(query_objects, out_encoder,ref_points,tgt_mask,
                             memory_masks,tgt_key_padding_mask,
                             memory_key_padding_masks, positional_embeddings, query_poses)
        return self.forward_post_norm(query_objects, out_encoder,ref_points,tgt_mask,
                         memory_masks,tgt_key_padding_mask,
                         memory_key_padding_masks, positional_embeddings, query_poses)

    def forward_post_norm(self, query_objects, out_encoder, ref_points, tgt_mask = None, memory_masks = None,
                          tgt_key_padding_mask = None, memory_key_padding_masks = None, positional_embeddings = None,
                          query_poses = None):
        # self attention
        q = query_objects + query_poses
        k = q
        query_objects_2 = self.self_attn(q, k, value=query_objects, attn_mask=tgt_mask,key_padding_mask=tgt_key_padding_mask)[0]
        query_objects = query_objects + self.dropout2(query_objects_2)
        query_objects = self.norm1(query_objects)
        # get the output of the encoder with positional embeddings
        out_encoder = [ tensor + pos for tensor, pos in zip(out_encoder, positional_embeddings)] #?
        #query_objects is of same shape as nn.Embedding(number of object queries, C)
        # L, B, C -> B, L, 1, C | L: number of object queries, B: size of batch
        query_objects = query_objects.transpose(0, 1).unsqueeze(dim=2)
        ref_points = ref_points.transpose(0, 1).unsqueeze(dim=2)
        # B, L, 1, 2
        query_objects_2, attention_weights = self.def_attn(query_objects, out_encoder, ref_points,query_mask=None, x_masks=memory_key_padding_masks)
        query_objects = query_objects + self.dropout2(query_objects_2)
        query_objects = self.norm2(query_objects)
        query_objects = self.ffn(query_objects)
        query_objects = self.norm3(query_objects) #post normalization
        # B, L, 1, C -> L, B, C
        query_objects = query_objects.squeeze(dim=2)
        query_objects = query_objects.transpose(0, 1).contiguous()
        return query_objects

    def forward_pre_norm(self, query_objects, out_encoder, ref_points, tgt_mask = None, memory_masks = None,
                         tgt_key_padding_mask = None, memory_key_padding_masks = None, positional_embeddings = None,
                         query_poses = None):

        # self attention
        query_objects_2 = self.norm1(query_objects)
        q = query_objects_2 + query_poses
        k = q
        query_objects_2 = self.self_attn(q, k, value=query_objects, attn_mask=tgt_mask,key_padding_mask=tgt_key_padding_mask)[0]
        query_objects = query_objects + self.dropout2(query_objects_2)
        query_objects_2 = self.norm2(query_objects)
        # get the output of the encoder with positional embeddings
        out_encoder = [ tensor + pos for tensor, pos in zip(out_encoder, positional_embeddings)]
        #query_objects is of same shape as nn.Embedding(number of object queries, C)
        # L, B, C -> B, L, 1, C | L: number of object queries, B: size of batch
        query_objects = query_objects.transpose(0, 1).unsqueeze(dim=2)
        query_ref_point = query_ref_point.transpose(0, 1).unsqueeze(dim=2)
        # B, L, 1, 2
        query_objects_2, attention_weights = self.def_attn(q, out_encoder, query_ref_point, query_mask=None, x_masks=memory_key_padding_masks)
        query_objects = query_objects + self.dropout2(query_objects_2)
        query_objects = self.norm3(query_objects)
        query_objects = self.ffn(query_objects)
        # B, L, 1, C -> L, B, C
        query_objects = query_objects.squeeze(dim=2)
        query_objects = query_objects.transpose(0, 1).contiguous()

        return query_objects


class DeformableTransformerDecoder(nn.Module):

    def __init__(self, decoder_layer, num_layers, norm=None,return_intermediate=False):
        """
        Args:
            - decoder_layer: an instance of the DeformableTransformerDecoderLayer() class.
            - num_layers: the number of sub-decoder-layers in the decoder.
            - norm: the layer normalization component (optional).
        """
        super().__init__()
        self.layers = nn.ModuleList([copy.deepcopy(decoder_layer) for i in range(num_layers)])
        self.num_layers = num_layers
        self.return_intermediate = return_intermediate
        self.norm = norm

    def forward(self, query_objects, out_encoder, ref_point, tgt_mask = None, memory_masks = None,
                tgt_key_padding_mask = None, memory_key_padding_masks = None, positional_embeddings = None, query_pos = None):

        # input of the decoder layers
        output = query_objects
        intermediate = []
        for layer in self.layers:
            output = layer(output, out_encoder, ref_point, tgt_mask = tgt_mask,memory_masks = memory_masks,tgt_key_padding_mask = tgt_key_padding_mask,
                           memory_key_padding_masks = memory_key_padding_masks,positional_embeddings= positional_embeddings,query_poses = query_pos)
            if self.return_intermediate:
                intermediate.append(self.norm(output))
        if self.norm is not None:
            output = self.norm(output)
            if self.return_intermediate:
                intermediate.pop()
                intermediate.append(output)
        if self.return_intermediate:
            return torch.stack(intermediate)

        return output


class FeedForward(nn.Module):
    """Simple Feed Forward Network"""
    def __init__(self, C=256, d_ffn=1024, dropout=0.5):
        super(FeedForward, self).__init__()
        self.C = C
        self.d_ffn = d_ffn
        self.linear1 = nn.Linear(C, d_ffn)
        self.dropout1 = nn.Dropout(dropout)
        self.linear2 = nn.Linear(d_ffn, C)
        self.dropout2 = nn.Dropout(dropout)

    def forward(self, attended):
        attended_tmp = self.linear2(self.dropout1(F.relu(self.linear1(attended))))
        attended = attended + self.dropout2(attended_tmp)
        return attended
\`\`\`

#### PositionalEncoding

\`\`\`python
import math
import torch
from torch import nn

from util.misc import NestedTensor


class PositionEmbeddingSine(nn.Module):
    """
    This is a more standard version of the position embedding, very similar to the one
    used by the Attention is all you need paper, generalized to work on images.
    """
    def __init__(self, num_pos_feats=64, temperature=10000, normalize=False, scale=None):
        super().__init__()
        self.num_pos_feats = num_pos_feats
        self.temperature = temperature
        self.normalize = normalize
        if scale is not None and normalize is False:
            raise ValueError("normalize should be True if scale is passed")
        if scale is None:
            scale = 2 * math.pi
        self.scale = scale

    def forward(self, tensor_list: NestedTensor):
        x = tensor_list.tensors
        mask = tensor_list.mask
        assert mask is not None
        not_mask = ~mask
        y_embed = not_mask.cumsum(1, dtype=torch.float32)
        x_embed = not_mask.cumsum(2, dtype=torch.float32)
        if self.normalize:
            eps = 1e-6
            y_embed = (y_embed - 0.5) / (y_embed[:, -1:, :] + eps) * self.scale
            x_embed = (x_embed - 0.5) / (x_embed[:, :, -1:] + eps) * self.scale

        dim_t = torch.arange(self.num_pos_feats, dtype=torch.float32, device=x.device)
        dim_t = self.temperature ** (2 * (dim_t // 2) / self.num_pos_feats)

        pos_x = x_embed[:, :, :, None] / dim_t
        pos_y = y_embed[:, :, :, None] / dim_t
        pos_x = torch.stack((pos_x[:, :, :, 0::2].sin(), pos_x[:, :, :, 1::2].cos()), dim=4).flatten(3)
        pos_y = torch.stack((pos_y[:, :, :, 0::2].sin(), pos_y[:, :, :, 1::2].cos()), dim=4).flatten(3)
        pos = torch.cat((pos_y, pos_x), dim=3).permute(0, 3, 1, 2)
        return pos


class PositionEmbeddingLearned(nn.Module):
    """
    Absolute pos embedding, learned.
    """
    def __init__(self, num_pos_feats=256):
        super().__init__()
        self.row_embed = nn.Embedding(50, num_pos_feats)
        self.col_embed = nn.Embedding(50, num_pos_feats)
        self.reset_parameters()

    def reset_parameters(self):
        nn.init.uniform_(self.row_embed.weight)
        nn.init.uniform_(self.col_embed.weight)

    def forward(self, tensor_list: NestedTensor):
        x = tensor_list.tensors
        h, w = x.shape[-2:]
        i = torch.arange(w, device=x.device)
        j = torch.arange(h, device=x.device)
        x_emb = self.col_embed(i)
        y_emb = self.row_embed(j)
        pos = torch.cat([
            x_emb.unsqueeze(0).repeat(h, 1, 1),
            y_emb.unsqueeze(1).repeat(1, w, 1),
        ], dim=-1).permute(2, 0, 1).unsqueeze(0).repeat(x.shape[0], 1, 1, 1)
        return pos


def build_position_encoding(args):
    N_steps = args.hidden_dim // 2
    if args.position_embedding in ('v2', 'sine'):
        # TODO find a better way of exposing other arguments
        position_embedding = PositionEmbeddingSine(N_steps, normalize=True)
    elif args.position_embedding in ('v3', 'learned'):
        position_embedding = PositionEmbeddingLearned(N_steps)
    else:
        raise ValueError(f"not supported {args.position_embedding}")

    return position_embedding
\`\`\`

#### Deformable Transformer

\`\`\`python
from torch.nn.init import xavier_uniform_, constant_, uniform_, normal_
from .encoder import DeformableTransformerEncoderLayer, DeformableTransformerEncoder
from .decoder import DeformableTransformerDecoderLayer, DeformableTransformerDecoder
from .MultiHeadAttention import DeformableHeadAttention, generate_ref_points


class DeformableTransformer(nn.Module):
    """Transformer module with deformable attention"""
    def __init__(self,
                 d_model=512,nhead=8, num_encoder_layers=6,num_decoder_layers=6, dim_feedforward=2048,dropout=0.1,
                 normalize_before=False, return_intermediate_dec=False, scales=4,k=4, last_height=16, last_width=16):
        """
        Args:
            - d_model : number of expected features in the encoder and decoder inputs.
            - nhead : number of heads.
            - num_encoder_layers : number of encoder layers.
            - num_decoder_layers : number of decoder layers.
            - dim_feedforward : feed forward network dimension.
            - dropout : the dropout value.
            - normalize_before : True if normalization is to be used before computing attention scores.
            - return_intermediate_dec : True if auxiliary decoding losses are to be used.
            - scales : multi-scale parameter.
            - k : number of sampling points.
            - last_height : smallest feature height.
            - last_width:smallest feature width.
        """
        super().__init__()

        encoder_layer = DeformableTransformerEncoderLayer(C=d_model, M=nhead, K=k, n_levels=scales, last_feat_height=last_height,
                                                          last_feat_width=last_width,d_ffn=dim_feedforward,dropout=dropout,
                                                          normalize_before=normalize_before)
        encoder_norm = nn.LayerNorm(d_model) if normalize_before else None
        self.encoder = DeformableTransformerEncoder(encoder_layer, num_encoder_layers, encoder_norm)

        decoder_layer = DeformableTransformerDecoderLayer(C=d_model, M=nhead, K=k, n_levels=scales, last_feat_height=last_height,
                                                          last_feat_width=last_width,d_ffn=dim_feedforward, dropout=dropout,
                                                        normalize_before=normalize_before)

        decoder_norm = nn.LayerNorm(d_model)
        self.decoder = DeformableTransformerDecoder(decoder_layer, num_decoder_layers, decoder_norm,
                                          return_intermediate=return_intermediate_dec)

        self._reset_parameters()

        self.d_model = d_model
        self.C = d_model
        self.nhead = nhead

        self.query_ref_point_proj = nn.Linear(d_model, 2)

    def _reset_parameters(self):
        for p in self.parameters():
            if p.dim() > 1:
                nn.init.xavier_uniform_(p)

    def forward(self, src, masks, query_embed, pos_embeds):
        """
        Args:
            src : batched images.
            masks : masks for input images.
            query_embed: query embeddings (objects Deformable DETR can detect in an image).
            pos_embeds: inputs positional embeddings.
        """
        bs = src[0].size(0)
        query_embed = query_embed.unsqueeze(1).repeat(1, bs, 1)

        # B, C H, W -> B, H, W, C
        for index in range(len(src)):
            src[index] = src[index].permute(0, 2, 3, 1)
            pos_embeds[index] = pos_embeds[index].permute(0, 2, 3, 1)

        # B, H, W, C
        ref_points = []
        for tensor in src:
            _, height, width, _ = tensor.shape
            ref_point = generate_ref_points(width=width,
                                            height=height)
            ref_point = ref_point.type_as(src[0])
            # H, W, 2 -> B, H, W, 2
            ref_point = ref_point.unsqueeze(0).repeat(bs, 1, 1, 1)
            ref_points.append(ref_point)

        tgt = torch.zeros_like(query_embed)

        # List[B, H, W, C]
        memory = self.encoder(src, ref_points, padding_mask=masks, pos_encodings=pos_embeds)

        # L, B, C
        query_ref_point = self.query_ref_point_proj(tgt)
        query_ref_point = F.sigmoid(query_ref_point)

        # Decoder Layers, L, B ,C
        hs = self.decoder(tgt, memory, query_ref_point, memory_key_padding_masks=masks, positional_embeddings=pos_embeds, query_pos=query_embed)

        return hs, query_ref_point, memory
\`\`\`

#### DeformableDETR

\`\`\`python
import math
from util import box_ops
from util.misc import (NestedTensor, nested_tensor_from_tensor_list,
                       accuracy, get_world_size, interpolate,
                       is_dist_avail_and_initialized, inverse_sigmoid)
from .backbone import build_backbone
from .matcher import build_matcher
from .losses import SetCriterion
from .deformable_transformer import DeformableTransformer


class DeformableDETR(nn.Module):
    """ This is the Deformable DETR module that performs object detection with deformable attention"""

    def __init__(self, backbone, transformer, num_classes, num_queries, num_feature_levels, aux_loss=False):
        """
        Args:
            - backbone : module of the backbone to be used.
            - transformer : module of the transformer.
            - num_classes : number of classes.
            - num_queries : the maximal number of objects Deformable DETR can detect in an image.
            - num_feature_levels : number of multi-scale levels.
            - aux_loss : True if auxiliary decoding losses are to be used.
        """
        super().__init__()
        self.transformer = transformer  # The deformable transformer
        self.num_queries = num_queries  # Number of objects to predict in parallel
        self.query_embed = nn.Embedding(num_queries, self.transformer.C)

        #  for class prediction
        self.class_pred = nn.Linear(transformer.C, num_classes)
        prior_prob = 0.01
        bias_value = -math.log((1 - prior_prob) / prior_prob)
        self.class_pred.bias.data = torch.ones(num_classes) * bias_value
        num_pred = self.transformer.decoder.num_layers
        #self.class_pred = nn.ModuleList([self.class_pred for _ in range(num_pred)])
        # for boxes prediction
        self.bbox_pred = MLP(transformer.C, transformer.C, 4, 3)
        #self.bbox_pred = nn.ModuleList([self.bbox_pred for _ in range(num_pred)])
        # Multi scale feature map
        self.num_feature_levels = num_feature_levels
        self.backbone = backbone
        self.aux_loss = aux_loss
        if num_feature_levels > 1:
            self.input_proj = self.get_projections()
        else:
            self.input_proj = nn.ModuleList([
                nn.Sequential(
                    nn.Conv2d(backbone.num_channels[0], transformer.C, kernel_size=1),
                    nn.GroupNorm(32, transformer.C),
                )])

        self.transformer.decoder.bbox_pred = None

    def get_projections(self):
        input_projections = []
        for _ in range(len(self.backbone.strides)):
            in_channels = self.backbone.num_channels[_]
            input_projections.append(nn.Sequential(
                nn.Conv2d(in_channels, self.transformer.C, kernel_size=1),
                nn.GroupNorm(32, self.transformer.C),
            ))
        for _ in range(self.num_feature_levels - len(self.backbone.strides)):
            input_projections.append(nn.Sequential(
                nn.Conv2d(in_channels, self.transformer.C, kernel_size=3, stride=2, padding=1),
                nn.GroupNorm(32, self.transformer.C),
            ))
            in_channels = self.transformer.C
        return nn.ModuleList(input_projections)

    def forward(self, samples):
        """
        Args:
            - samples : (tensor, mask) batch of images.
        """
        if not isinstance(samples, NestedTensor):
            samples = nested_tensor_from_tensor_list(samples)
        features, poses = self.backbone(samples)  # set of image features + positional encoding

        srcs = []
        masks = []
        for l, feat in enumerate(features):
            src, mask = feat.decompose()
            srcs.append(self.input_proj[l](src))
            masks.append(mask)
        # For multi scale features
        if self.num_feature_levels > len(srcs):
            for l in range(len(srcs), self.num_feature_levels):
                if l == len(srcs):
                    src = self.input_proj[l](features[-1].tensors)
                else:
                    src = self.input_proj[l](srcs[-1])
                m = samples.mask
                mask = F.interpolate(m[None].float(), size=src.shape[-2:]).to(torch.bool)[0]
                pos_l = self.backbone[1](NestedTensor(src, mask)).to(src.dtype)
                srcs.append(src)
                masks.append(mask)
                poses.append(pos_l)
        hs, ref_point, _ = self.transformer(srcs, masks, self.query_embed.weight, poses)
        hs = hs.transpose(1, 2).contiguous()
        ref_point = ref_point.transpose(0, 1).contiguous()
        inversed_ref_point = - torch.log(1 / (ref_point + 1e-10) - 1 + 1e-10)
        outputs_coord = self.bbox_pred(hs)
        outputs_coord[..., 0] = outputs_coord[..., 0] + inversed_ref_point[..., 0]
        outputs_coord[..., 1] = outputs_coord[..., 1] + inversed_ref_point[..., 1]
        outputs_coord = torch.sigmoid(outputs_coord)
        outputs_class = self.class_pred(hs)
        out = {'pred_logits': outputs_class[-1], 'pred_boxes': outputs_coord[-1]}
        if self.aux_loss:
            out['aux_outputs'] = [{'pred_logits': a, 'pred_boxes': b}
                                  for a, b in zip(outputs_class[:-1], outputs_coord[:-1])]
        return out


# Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved
class PostProcess(nn.Module):
    """ This module converts the model's output into the format expected by the coco api"""

    @torch.no_grad()
    def forward(self, outputs, target_sizes):
        """ Perform the computation
        Args:
            - outputs: raw outputs of the model.
            - target_sizes: tensor of dimension [batch_size x 2] containing the size of each images of the batch
                          For evaluation, this must be the original image size (before any data augmentation)
                          For visualization, this should be the image size after data augment, but before padding
        """
        out_logits, out_bbox = outputs['pred_logits'], outputs['pred_boxes']

        assert len(out_logits) == len(target_sizes)
        assert target_sizes.shape[1] == 2

        prob = out_logits.sigmoid()
        topk_values, topk_indexes = torch.topk(prob.view(out_logits.shape[0], -1), 100, dim=1)
        scores = topk_values
        topk_boxes = topk_indexes // out_logits.shape[2]
        labels = topk_indexes % out_logits.shape[2]
        boxes = box_ops.box_cxcywh_to_xyxy(out_bbox)
        boxes = torch.gather(boxes, 1, topk_boxes.unsqueeze(-1).repeat(1, 1, 4))

        # and from relative [0, 1] to absolute [0, height] coordinates
        img_h, img_w = target_sizes.unbind(1)
        scale_fct = torch.stack([img_w, img_h, img_w, img_h], dim=1)
        boxes = boxes * scale_fct[:, None, :]

        results = [{'scores': s, 'labels': l, 'boxes': b} for s, l, b in zip(scores, labels, boxes)]

        return results


class MLP(nn.Module):
    """ Simple multi-layer perceptron"""

    def __init__(self, input_dim, hidden_dim, output_dim, num_layers):
        super().__init__()
        self.num_layers = num_layers
        h = [hidden_dim] * (num_layers - 1)
        self.layers = nn.ModuleList(nn.Linear(n, k) for n, k in zip([input_dim] + h, h + [output_dim]))

    def forward(self, x):
        for i, layer in enumerate(self.layers):
            x = F.relu(layer(x)) if i < self.num_layers - 1 else layer(x)
        return x


def build(args):
    num_classes = 6
    device = torch.device(args.device)
    backbone = build_backbone(args)
    transformer = DeformableTransformer(
        d_model=args.hidden_dim,
        dropout=args.dropout,
        nhead=args.nheads,
        dim_feedforward=args.dim_feedforward,
        num_encoder_layers=args.enc_layers,
        num_decoder_layers=args.dec_layers,
        normalize_before=args.pre_norm,
        return_intermediate_dec=True,
        scales=args.num_feature_levels,
        k=args.dec_n_points,
        last_height=args.last_height,
        last_width=args.last_width
    )

    model = DeformableDETR(
        backbone,
        transformer,
        num_classes=num_classes,
        num_queries=args.num_queries,
        num_feature_levels=args.num_feature_levels,
        aux_loss=args.aux_loss,
    )
    matcher = build_matcher(args)
    weight_dict = {'loss_ce': args.cls_loss_coef, 'loss_bbox': args.bbox_loss_coef}
    weight_dict['loss_giou'] = args.giou_loss_coef
    if args.aux_loss:
        aux_weight_dict = {}
        for i in range(args.dec_layers - 1):
            aux_weight_dict.update({k + f'_{i}': v for k, v in weight_dict.items()})
        aux_weight_dict.update({k + f'_enc': v for k, v in weight_dict.items()})
        weight_dict.update(aux_weight_dict)
    losses = ['labels', 'boxes', 'cardinality']
    criterion = SetCriterion(num_classes, matcher, weight_dict, losses, focal_alpha=args.focal_alpha)
    criterion.to(device)
    postprocessors = {'bbox': PostProcess()}
    return model, criterion, postprocessors
\`\`\`
`;export{e as default};
