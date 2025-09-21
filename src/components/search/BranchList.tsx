import React from "react";
import BranchCard from "@/components/search/BranchCard";
import type { BranchItem } from "@/components/search/types";

type BranchListProps = {
    branches: BranchItem[];
    onView: (id: number) => void;
};

const BranchList: React.FC<BranchListProps> = ({ branches, onView }) => {
    if (branches.length === 0) {
        return null;
    }

    return (
        <div className="grid gap-4">
            {branches.map((branch) => (
                <BranchCard key={branch.id} branch={branch} onView={onView} />
            ))}
        </div>
    );
};

export default BranchList;
