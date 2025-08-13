-- Criar políticas de storage para bucket de produtos
-- Permitir que usuários autenticados façam upload de imagens de produtos
CREATE POLICY "Authenticated users can upload product images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'products');

-- Permitir que usuários autenticados visualizem imagens de produtos
CREATE POLICY "Anyone can view product images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'products');

-- Permitir que usuários autenticados atualizem imagens de produtos
CREATE POLICY "Authenticated users can update product images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'products');

-- Permitir que usuários autenticados excluam imagens de produtos
CREATE POLICY "Authenticated users can delete product images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'products');