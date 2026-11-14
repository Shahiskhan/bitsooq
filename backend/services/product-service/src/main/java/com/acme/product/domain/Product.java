package com.acme.product.domain;
public record Product(String sku, String name, String nameAr, String descriptionEn, String descriptionAr,
                      long priceMinor, String currency, int availableStock, String categoryId, long version, boolean active) {
    public Product(String sku,String name,long priceMinor,String currency,int availableStock) {
        this(sku,name,null,null,null,priceMinor,currency,availableStock,null,0,true);
    }
}
