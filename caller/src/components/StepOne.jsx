import React from "react";
import { Form, Formik } from "formik";
import { formSchema } from "../schemas/stepOneSchema";
import { Input } from "./Input";

const todayDate = () => {
  let date = new Date();
  let currentDate = date.getDate();
  let currentMonth = date.getMonth() + 1;
  let currentYear = date.getFullYear();
  return (
    currentYear +
    "-" +
    (currentMonth < 10 ? "0" + currentMonth : currentMonth) +
    "-" +
    (currentDate < 10 ? "0" + currentDate : currentDate)
  );
};

export const StepOne = (props) => {
  const submitdatacollected = (values, actions) => {
    console.log("Form values being submitted:", values);
    props.next(values, true);
  };

  const initialValues = {
    openapijsonurl: process.env.REACT_APP_OPENAPIJSONURL,
    startingDate: todayDate(),
    subjectuniqueidentifierUrl:
      process.env.REACT_APP_SUBJECTUNIQUEIDENTIFIERURL,
    base58spprivateKey: "",
    accountId: process.env.REACT_APP_MINTING_FEEACCOUNT,
  };

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={formSchema}
      onSubmit={submitdatacollected}
    >
      {({ isSubmitting, values }) => (
        <Form className="w-full">
          {/* First row */}
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <Input
              label="Service Swagger URL"
              name="openapijsonurl"
              type="text"
              placeholder="api-not-set.example.com/api-docs"
            />
            <Input
              label="Starting Date"
              name="startingDate"
              type="date"
              placeholder={todayDate()}
            />
          </div>
          {/* Second row */}
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <Input
              label="Default Service API URL"
              name="subjectuniqueidentifierUrl"
              type="text"
              placeholder="api-not-set.example.com/v1"
            />
            <Input
              label="Sanctum Implicit Account"
              name="accountId"
              type="text"
              placeholder="Implicit account ID"
            />
          </div>
          {/* Third row - full width for the private key */}
          <div className="mb-4">
            <Input
              label="Private Key of Sanctum Implicit Account in Base58"
              name="base58spprivateKey"
              type="text"
              placeholder="Enter your base58 private key here"
            />
          </div>
          {/* Button row */}
          <div className="flex items-center justify-center mt-6">
            <button
              className="inline-flex items-center rounded-xl duration-300 ease-in-out bg-indigo-700 px-8 py-3 text-white shadow-lg transition hover:bg-indigo-600 focus:outline-none"
              disabled={isSubmitting}
              type="submit"
            >
              Mint
            </button>
          </div>
        </Form>
      )}
    </Formik>
  );
};