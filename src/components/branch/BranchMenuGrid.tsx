import React from "react";
import BranchProductCard, { type BranchProduct } from "./BranchProductCard";

type Props = {
    products: BranchProduct[];
    onPick: (product: BranchProduct) => void;
};

const BranchMenuGrid: React.FC<Props> = ({ products, onPick }) => {
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
                <BranchProductCard key={product.id} product={product} onClick={() => onPick(product)} />
            ))}
        </div>
    );
};

export default BranchMenuGrid;
