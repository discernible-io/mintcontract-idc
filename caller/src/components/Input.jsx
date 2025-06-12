import React from 'react';
import { useField } from "formik";
import cn from 'classnames';

export const Input = ({ label, ...props }) => {
  const [field, meta] = useField(props);
  const isError = meta.touched && meta.error;

  return (
    <div className="mb-4">
      <label 
        htmlFor={props.id || props.name} 
        className="block mb-2 text-sm font-medium text-gray-900"
      >
        {label}
      </label>
      <input
        {...field}
        {...props}
        className={cn(
          "shadow-sm border text-gray-900 text-sm rounded-lg block w-full p-2.5",
          "focus:ring-blue-500 focus:border-blue-500",
          {
            "border-red-500 bg-red-50": isError,
            "border-gray-300 bg-gray-50": !isError
          }
        )}
      />
      {isError && (
        <p className="mt-2 text-sm text-red-600">{meta.error}</p>
      )}
    </div>
  );
};