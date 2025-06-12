import React from 'react';
import { StepOne } from "./StepOne";

const RODITForm = ({ data, next }) => {
  return (
    <div className="flex mt-12 lg:mt-2 flex-col w-full max-w-md px-6 pt-2 pb-8 items-center justify-center rounded-xl border bg-slate-100 border-gray-100 shadow-xl">
      <h1 className="text-2xl tracking-wide font-semibold py-3">
        RODiT Sanctum/Portal API @testnet
      </h1>
      <div className="flex flex-col items-center justify-center w-full">
        <div className="flex items-center mt-4 justify-center w-full">
          <StepOne next={next} data={data} />
        </div>
      </div>
    </div>
  );
};

export default RODITForm;